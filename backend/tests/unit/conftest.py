"""Conftest for unit tests: override DB fixtures with no-ops."""

import pytest


@pytest.fixture(scope="session", autouse=True)
def ensure_test_database():
    """Override the session-level DB bootstrap for pure unit tests."""
    yield


@pytest.fixture(autouse=True)
def setup_database():
    """Override the autouse DB fixture — unit tests don't need a database."""
    yield
