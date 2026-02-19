"""
Zaytri — Cryptography Utilities
Fernet-based encryption for storing API keys securely in the database.
"""

import base64
import hashlib
import json
from typing import Any, Dict

from cryptography.fernet import Fernet

from config import settings


def _derive_key(secret: str) -> bytes:
    """Derive a 32-byte Fernet key from the JWT secret."""
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def get_fernet() -> Fernet:
    """Get a Fernet instance using the application secret."""
    return Fernet(_derive_key(settings.jwt_secret_key))


def encrypt_dict(data: Dict[str, Any]) -> str:
    """
    Encrypt a dictionary to a base64 string.

    Args:
        data: Dictionary of key-value pairs (e.g. API credentials)

    Returns:
        Encrypted string safe for database storage
    """
    f = get_fernet()
    json_bytes = json.dumps(data).encode("utf-8")
    return f.encrypt(json_bytes).decode("utf-8")


def decrypt_dict(encrypted: str) -> Dict[str, Any]:
    """
    Decrypt a base64 string back to a dictionary.

    Args:
        encrypted: Encrypted string from the database

    Returns:
        Original dictionary of credentials
    """
    f = get_fernet()
    json_bytes = f.decrypt(encrypted.encode("utf-8"))
    return json.loads(json_bytes.decode("utf-8"))


def encrypt_value(value: str) -> str:
    """
    Encrypt a single string value (e.g. an API key).

    Args:
        value: Plain text string to encrypt

    Returns:
        Encrypted string safe for database storage
    """
    f = get_fernet()
    return f.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_value(encrypted: str) -> str:
    """
    Decrypt a single string value back to plain text.

    Args:
        encrypted: Encrypted string from the database

    Returns:
        Original plain text string
    """
    f = get_fernet()
    return f.decrypt(encrypted.encode("utf-8")).decode("utf-8")


def mask_value(value: str, visible_chars: int = 4) -> str:
    """
    Mask a credential value for safe display.
    Shows only the last N characters.

    Example: "sk-abc123def456" → "••••••••f456"
    """
    if not value or len(value) <= visible_chars:
        return "••••"
    return "•" * (len(value) - visible_chars) + value[-visible_chars:]
