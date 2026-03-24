"""Tests for get_client_ip to ensure Cloudflare proxy headers are respected."""

from unittest.mock import MagicMock

from app.security import get_client_ip


class TestGetClientIp:
    def _make_request(self, headers: dict[str, str]) -> MagicMock:
        request = MagicMock()
        request.headers = headers
        request.client.host = "10.0.0.1"
        return request

    def test_prefers_cf_connecting_ip(self):
        request = self._make_request({
            "CF-Connecting-IP": "203.0.113.50",
            "X-Forwarded-For": "198.51.100.10, 10.0.0.1",
        })
        assert get_client_ip(request) == "203.0.113.50"

    def test_falls_back_to_x_forwarded_for(self):
        request = self._make_request({
            "X-Forwarded-For": "198.51.100.10, 10.0.0.1",
        })
        assert get_client_ip(request) == "198.51.100.10"

    def test_falls_back_to_remote_address(self):
        request = self._make_request({})
        result = get_client_ip(request)
        # get_remote_address returns request.client.host
        assert result == "10.0.0.1"

    def test_strips_whitespace_from_cf_ip(self):
        request = self._make_request({"CF-Connecting-IP": "  203.0.113.50  "})
        assert get_client_ip(request) == "203.0.113.50"

    def test_strips_whitespace_from_forwarded_for(self):
        request = self._make_request({"X-Forwarded-For": " 198.51.100.10 , 10.0.0.1"})
        assert get_client_ip(request) == "198.51.100.10"

    def test_single_x_forwarded_for(self):
        request = self._make_request({"X-Forwarded-For": "198.51.100.10"})
        assert get_client_ip(request) == "198.51.100.10"
