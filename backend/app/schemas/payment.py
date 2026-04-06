from datetime import datetime

from pydantic import BaseModel

from app.models.payment_order import OrderStatus, ProductType


class CheckoutRequest(BaseModel):
    product_type: ProductType


class CheckoutResponse(BaseModel):
    order_no: str
    ecpay_form_html: str


class OrderResponse(BaseModel):
    order_no: str
    product_type: ProductType
    amount: int
    status: OrderStatus
    paid_at: datetime | None = None
    created_at: datetime


class PaymentHistoryResponse(BaseModel):
    orders: list[OrderResponse]
