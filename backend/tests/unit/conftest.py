"""Conftest for unit tests: override DB fixtures with no-ops."""

import pytest


@pytest.fixture(autouse=True)
def setup_database():
    """Override the autouse DB fixture — unit tests don't need a database."""
    yield
