"""
Zaytri — API Tests
Tests for the FastAPI endpoints.
"""

import pytest
from unittest.mock import AsyncMock, patch


def test_root_endpoint():
    """Test the root endpoint returns app info."""
    from fastapi.testclient import TestClient
    from main import app

    # Patch the lifespan to avoid DB/Ollama initialization
    with patch("main.init_db", new_callable=AsyncMock):
        with patch("main.close_db", new_callable=AsyncMock):
            client = TestClient(app)
            response = client.get("/")
            assert response.status_code == 200
            data = response.json()
            assert data["name"] == "Zaytri API"
            assert data["version"] == "1.0.0"
