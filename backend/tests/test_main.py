from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestHealthEndpoints:
    async def test_health_returns_ok(self, client: AsyncClient):
        response = await client.get("/health")

        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    @patch("app.main.check_database_readiness", new_callable=AsyncMock)
    async def test_readiness_returns_ready(self, mock_check, client: AsyncClient):
        response = await client.get("/readiness")

        assert response.status_code == 200
        assert response.json() == {"status": "ready", "checks": {"database": "ok"}}
        mock_check.assert_awaited_once()

    @patch("app.main.check_database_readiness", new_callable=AsyncMock)
    async def test_readiness_returns_503_when_database_unavailable(
        self, mock_check, client: AsyncClient
    ):
        mock_check.side_effect = RuntimeError("db down")

        response = await client.get("/readiness")

        assert response.status_code == 503
        assert response.json() == {"detail": "Database not ready"}
