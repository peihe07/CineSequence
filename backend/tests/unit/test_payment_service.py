"""Unit tests for payment service logic."""

from app.models.payment_order import ProductType
from app.models.user_entitlement import EntitlementType
from app.services.payment_service import (
    PRODUCT_CATALOG,
    _compute_check_mac_value,
    _generate_order_no,
    verify_check_mac_value,
)


class TestGenerateOrderNo:
    def test_format_and_length(self):
        order_no = _generate_order_no()
        assert order_no.startswith("CS")
        assert len(order_no) <= 20

    def test_uniqueness(self):
        orders = {_generate_order_no() for _ in range(100)}
        assert len(orders) == 100


class TestCheckMacValue:
    def test_round_trip(self):
        params = {
            "MerchantID": "3002607",
            "MerchantTradeNo": "CS12345678ABCDEFGH",
            "TotalAmount": "59",
        }
        mac = _compute_check_mac_value(params)
        params["CheckMacValue"] = mac
        assert verify_check_mac_value(params)

    def test_tampered_value_fails(self):
        params = {
            "MerchantID": "3002607",
            "MerchantTradeNo": "CS12345678ABCDEFGH",
            "TotalAmount": "59",
            "CheckMacValue": "INVALID",
        }
        assert not verify_check_mac_value(params)


class TestProductCatalog:
    def test_all_product_types_have_catalog(self):
        for pt in ProductType:
            assert pt in PRODUCT_CATALOG

    def test_bundle_has_correct_entitlements(self):
        bundle = PRODUCT_CATALOG[ProductType.bundle]
        assert bundle["amount"] == 199
        types = [t for t, _ in bundle["entitlements"]]
        assert EntitlementType.retest in types
        assert EntitlementType.extension in types

    def test_extension_price(self):
        assert PRODUCT_CATALOG[ProductType.extension]["amount"] == 59

    def test_retest_price(self):
        assert PRODUCT_CATALOG[ProductType.retest]["amount"] == 129
