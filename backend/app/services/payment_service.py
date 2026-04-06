"""Payment service: order creation, ECPay callback verification, entitlement granting."""

import hashlib
import logging
import time
import urllib.parse
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.payment_order import OrderStatus, PaymentOrder, ProductType
from app.models.user import User
from app.models.user_entitlement import EntitlementStatus, EntitlementType, UserEntitlement

logger = logging.getLogger(__name__)

# product_type → (price TWD, entitlements to grant)
PRODUCT_CATALOG: dict[ProductType, dict] = {
    ProductType.extension: {
        "amount": 59,
        "entitlements": [(EntitlementType.extension, 1)],
    },
    ProductType.retest: {
        "amount": 129,
        "entitlements": [(EntitlementType.retest, 1)],
    },
    ProductType.bundle: {
        "amount": 199,
        "entitlements": [
            (EntitlementType.retest, 1),
            (EntitlementType.extension, 2),
        ],
    },
    ProductType.invite_unlock: {
        "amount": 99,
        "entitlements": [],  # handled via user.invite_unlocked flag
    },
    ProductType.share_card: {
        "amount": 59,
        "entitlements": [],  # handled via share_card model
    },
}


def _generate_order_no() -> str:
    """Generate unique order number: CS{timestamp}{random}, max 20 chars."""
    ts = str(int(time.time()))[-8:]
    rand = uuid.uuid4().hex[:8].upper()
    return f"CS{ts}{rand}"[:20]


def _compute_check_mac_value(params: dict[str, str]) -> str:
    """Compute ECPay CheckMacValue using SHA256."""
    sorted_params = sorted(params.items(), key=lambda x: x[0].lower())
    raw = "&".join(f"{k}={v}" for k, v in sorted_params)
    raw = f"HashKey={settings.ecpay_hash_key}&{raw}&HashIV={settings.ecpay_hash_iv}"
    encoded = urllib.parse.quote_plus(raw).lower()
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest().upper()


async def create_order(
    db: AsyncSession, user_id: uuid.UUID, product_type: ProductType
) -> PaymentOrder:
    """Create a pending payment order."""
    catalog = PRODUCT_CATALOG[product_type]
    order = PaymentOrder(
        user_id=user_id,
        order_no=_generate_order_no(),
        product_type=product_type,
        amount=catalog["amount"],
        status=OrderStatus.pending,
    )
    db.add(order)
    await db.flush()
    return order


def build_ecpay_form_html(order: PaymentOrder) -> str:
    """Build ECPay checkout form HTML for client-side redirect."""
    base_url = (
        "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5"
        if settings.ecpay_sandbox
        else "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5"
    )

    params = {
        "MerchantID": settings.ecpay_merchant_id,
        "MerchantTradeNo": order.order_no,
        "MerchantTradeDate": datetime.now(timezone.utc).strftime("%Y/%m/%d %H:%M:%S"),
        "PaymentType": "aio",
        "TotalAmount": str(order.amount),
        "TradeDesc": "Cine Sequence",
        "ItemName": order.product_type.value,
        "ReturnURL": f"{settings.api_url}/payments/callback",
        "ClientBackURL": f"{settings.frontend_url}/payments/return?order_no={order.order_no}",
        "ChoosePayment": "Credit",
        "EncryptType": "1",
    }
    params["CheckMacValue"] = _compute_check_mac_value(params)

    fields = "".join(
        f'<input type="hidden" name="{k}" value="{v}" />' for k, v in params.items()
    )
    return (
        f'<form id="ecpay-form" method="POST" action="{base_url}">'
        f"{fields}</form>"
    )


def verify_check_mac_value(params: dict[str, str]) -> bool:
    """Verify ECPay callback CheckMacValue."""
    received = params.get("CheckMacValue", "")
    check_params = {k: v for k, v in params.items() if k != "CheckMacValue"}
    expected = _compute_check_mac_value(check_params)
    return received == expected


def verify_callback_ip(client_ip: str) -> bool:
    """Verify callback request comes from ECPay servers."""
    if not settings.ecpay_callback_ips:
        # If not configured, skip IP check (dev/sandbox)
        return True
    allowed = {ip.strip() for ip in settings.ecpay_callback_ips.split(",") if ip.strip()}
    return client_ip in allowed


async def process_callback(
    db: AsyncSession, params: dict[str, str]
) -> str:
    """Process ECPay server-to-server callback. Returns '1|OK' on success."""
    order_no = params.get("MerchantTradeNo", "")
    result = await db.execute(
        select(PaymentOrder).where(PaymentOrder.order_no == order_no)
    )
    order = result.scalar_one_or_none()

    if not order:
        logger.warning("Callback for unknown order: %s", order_no)
        return "0|OrderNotFound"

    # Idempotency: already processed
    if order.status == OrderStatus.paid:
        return "1|OK"

    if not verify_check_mac_value(params):
        logger.warning("Invalid CheckMacValue for order: %s", order_no)
        return "0|CheckMacValueError"

    rtn_code = params.get("RtnCode", "")
    if rtn_code != "1":
        order.status = OrderStatus.failed
        await db.commit()
        return "1|OK"

    # Payment succeeded — grant entitlements in one transaction
    order.status = OrderStatus.paid
    order.ecpay_trade_no = params.get("TradeNo")
    order.paid_at = datetime.now(timezone.utc)

    await _grant_entitlements(db, order)
    await db.commit()

    logger.info("Payment completed: order=%s, user=%s", order.order_no, order.user_id)
    return "1|OK"


async def _grant_entitlements(db: AsyncSession, order: PaymentOrder) -> None:
    """Grant entitlements based on product type."""
    catalog = PRODUCT_CATALOG[order.product_type]

    for ent_type, count in catalog["entitlements"]:
        for _ in range(count):
            db.add(UserEntitlement(
                user_id=order.user_id,
                order_id=order.id,
                type=ent_type,
                status=EntitlementStatus.available,
            ))

    # Special handling for invite_unlock
    if order.product_type == ProductType.invite_unlock:
        result = await db.execute(
            select(User).where(User.id == order.user_id)
        )
        user = result.scalar_one()
        user.invite_unlocked = True


async def process_refund(db: AsyncSession, order_id: uuid.UUID) -> PaymentOrder:
    """Process refund: revoke unused entitlements, calculate partial refund."""
    result = await db.execute(
        select(PaymentOrder).where(PaymentOrder.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise ValueError("Order not found")
    if order.status != OrderStatus.paid:
        raise ValueError("Only paid orders can be refunded")

    ent_result = await db.execute(
        select(UserEntitlement).where(UserEntitlement.order_id == order.id)
    )
    entitlements = list(ent_result.scalars().all())

    if not entitlements:
        # invite_unlock or share_card — full refund
        order.refund_amount = order.amount
        order.status = OrderStatus.refunded
        await db.commit()
        return order

    available = [e for e in entitlements if e.status == EntitlementStatus.available]
    if not available:
        raise ValueError("All entitlements consumed, refund not allowed")

    for ent in available:
        ent.status = EntitlementStatus.revoked

    refund_ratio = len(available) / len(entitlements)
    order.refund_amount = int(order.amount * refund_ratio)
    order.status = OrderStatus.refunded
    await db.commit()

    logger.info(
        "Refund processed: order=%s, refund_amount=%d", order.order_no, order.refund_amount
    )
    return order


async def get_user_orders(
    db: AsyncSession, user_id: uuid.UUID
) -> list[PaymentOrder]:
    """Get all orders for a user, newest first."""
    result = await db.execute(
        select(PaymentOrder)
        .where(PaymentOrder.user_id == user_id)
        .order_by(PaymentOrder.created_at.desc())
    )
    return list(result.scalars().all())
