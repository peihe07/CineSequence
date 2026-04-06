"""Payment router: checkout, ECPay callback, return redirect, order history."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.payment import (
    CheckoutRequest,
    CheckoutResponse,
    OrderResponse,
    PaymentHistoryResponse,
)
from app.services.payment_service import (
    build_ecpay_form_html,
    create_order,
    get_user_orders,
    process_callback,
    verify_callback_ip,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    body: CheckoutRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a payment order and return ECPay form HTML."""
    order = await create_order(db, user.id, body.product_type)
    form_html = build_ecpay_form_html(order)
    await db.commit()
    return CheckoutResponse(order_no=order.order_no, ecpay_form_html=form_html)


@router.post("/callback")
async def payment_callback(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """ECPay server-to-server callback. No auth required."""
    client_ip = request.client.host if request.client else ""
    if not verify_callback_ip(client_ip):
        logger.warning("Callback from unauthorized IP: %s", client_ip)
        raise HTTPException(status_code=403, detail="Forbidden")

    form_data = await request.form()
    params = {k: v for k, v in form_data.items() if isinstance(v, str)}

    result = await process_callback(db, params)
    return result


@router.get("/history", response_model=PaymentHistoryResponse)
async def payment_history(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List the current user's payment orders."""
    orders = await get_user_orders(db, user.id)
    return PaymentHistoryResponse(
        orders=[
            OrderResponse(
                order_no=o.order_no,
                product_type=o.product_type,
                amount=o.amount,
                status=o.status,
                paid_at=o.paid_at,
                created_at=o.created_at,
            )
            for o in orders
        ]
    )
