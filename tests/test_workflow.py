"""
Zaytri — Workflow Pipeline Tests
Integration test for the Content → Hashtag → Review pipeline with mocked LLM.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_content_pipeline_full():
    """Test the complete pipeline: Content Creator → Hashtag → Review → DB save."""

    content_mock = {
        "caption": "AI is the future of business",
        "hook": "🔥 This will change everything...",
        "cta": "Follow for more AI insights!",
        "post_text": "Complete post text about AI.",
    }

    hashtag_mock = {
        "niche_hashtags": ["#AIstartups", "#TechFounders"],
        "broad_hashtags": ["#AI", "#Technology"],
    }

    review_mock = {
        "grammar_score": 9,
        "engagement_score": 8,
        "hook_score": 9,
        "compliance_score": 10,
        "overall_score": 9,
        "issues": [],
        "improvements": [],
        "improved_text": None,
        "is_approved": True,
    }

    with patch("agents.content_creator.get_llm") as mock_get_cc_llm, \
         patch("agents.hashtag_generator.get_llm") as mock_get_hg_llm, \
         patch("agents.review_agent.get_llm") as mock_get_ra_llm, \
         patch("db.database.async_session") as mock_session_factory:

        mock_cc_llm = AsyncMock()
        mock_cc_llm.generate_json.return_value = content_mock
        mock_get_cc_llm.return_value = mock_cc_llm

        mock_hg_llm = AsyncMock()
        mock_hg_llm.generate_json.return_value = hashtag_mock
        mock_get_hg_llm.return_value = mock_hg_llm

        mock_ra_llm = AsyncMock()
        mock_ra_llm.generate_json.return_value = review_mock
        mock_get_ra_llm.return_value = mock_ra_llm

        # Mock the database session
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        mock_content = MagicMock()
        mock_content.id = "test-content-id"
        mock_session.refresh = AsyncMock(side_effect=lambda obj: setattr(obj, 'id', 'test-content-id'))

        mock_session_factory.return_value = mock_session

        from workflow.pipeline import ContentPipeline
        pipeline = ContentPipeline()
        result = await pipeline.run(
            topic="AI for business",
            platform="instagram",
            tone="professional",
        )

        # Verify pipeline output structure
        assert "content" in result
        assert "hashtags" in result
        assert "review" in result
        assert result["content"]["caption"] == content_mock["caption"]
        assert result["hashtags"]["niche_hashtags"] == hashtag_mock["niche_hashtags"]
        assert result["review"]["is_approved"] is True
        assert result["status"] == "reviewed"

        # Verify all agents were called
        mock_cc_llm.generate_json.assert_called_once()
        mock_hg_llm.generate_json.assert_called_once()
        mock_ra_llm.generate_json.assert_called_once()
