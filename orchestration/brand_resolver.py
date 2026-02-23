"""
Zaytri — Brand Resolver (Orchestration Layer)
Given a user_id, resolve which brand context applies for RAG isolation.
"""

from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.settings_models import BrandSettings
from infra.logging import get_logger

logger = get_logger("orchestration.brand_resolver")


class BrandResolver:
    """
    Resolves brand context for multi-tenant isolation.
    Called before task planning to determine the brand scope.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def resolve(
        self,
        user_id: str,
        brand_name: Optional[str] = None,
    ) -> Optional[BrandSettings]:
        """
        Resolve the active brand for a user.

        Args:
            user_id: The user's UUID
            brand_name: Optional explicit brand name. If None, returns the
                        user's first/default brand.

        Returns:
            BrandSettings instance or None if no brand is configured
        """
        stmt = select(BrandSettings).where(BrandSettings.user_id == user_id)

        if brand_name:
            stmt = stmt.where(BrandSettings.brand_name == brand_name)

        result = await self.session.execute(stmt)
        brand = result.scalars().first()

        if brand:
            logger.info(f"Resolved brand '{brand.brand_name}' for user {str(user_id)[:8]}")
        else:
            logger.info(f"No brand found for user {str(user_id)[:8]}, using defaults")

        return brand

    async def list_brands(self, user_id: str) -> list:
        """List all brands for a user."""
        stmt = select(BrandSettings).where(BrandSettings.user_id == user_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
