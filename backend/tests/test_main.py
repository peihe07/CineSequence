from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.config import Settings
from app.security import build_allowed_origins, validate_csrf_origin


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


class TestSecuritySettings:
    def test_settings_load_env_files_from_backend_and_repo_root(self):
        env_files = Settings.model_config.get("env_file")
        assert env_files is not None

        resolved = {Path(path).resolve() for path in env_files}
        assert Path(__file__).resolve().parents[2].joinpath(".env").resolve() in resolved
        assert Path(__file__).resolve().parents[1].joinpath(".env").resolve() in resolved

    def test_build_allowed_origins_accepts_localhost_aliases(self):
        assert build_allowed_origins("http://127.0.0.1:3000") == [
            "http://127.0.0.1:3000",
            "http://localhost:3000",
        ]

    def test_production_rejects_default_secrets(self):
        with pytest.raises(ValueError):
            Settings(
                environment="production",
                jwt_secret="change-me",
                magic_link_secret="change-me",
                _env_file=None,
            )

    def test_non_production_allows_default_secrets_without_warning_noise(self, caplog):
        Settings(
            environment="development",
            jwt_secret="change-me",
            magic_link_secret="change-me",
            _env_file=None,
        )

        assert "SECURITY:" not in caplog.text

    def test_csrf_origin_rejects_untrusted_origin(self):
        class DummyRequest:
            headers = {"origin": "https://evil.example"}

        with pytest.raises(Exception) as exc_info:
            validate_csrf_origin(DummyRequest())  # type: ignore[arg-type]

        assert exc_info.value.status_code == 403
