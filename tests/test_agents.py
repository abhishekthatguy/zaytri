"""
Zaytri — Agent Unit Tests
Tests each agent with mocked LLM responses.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock


# ─── Content Creator Agent ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_content_creator_agent():
    """Test that ContentCreatorAgent calls LLM and returns structured output."""
    mock_response = {
        "caption": "AI is transforming how founders build companies.",
        "hook": "🚀 Stop doing this manually...",
        "cta": "Save this post for later! 💾",
        "post_text": "🚀 Stop doing this manually... AI automation is here.",
    }

    with patch("agents.content_creator.llm") as mock_llm:
        mock_llm.generate_json = AsyncMock(return_value=mock_response)

        from agents.content_creator import ContentCreatorAgent
        agent = ContentCreatorAgent()
        result = await agent.run({
            "topic": "AI automation for founders",
            "platform": "instagram",
            "tone": "confident",
        })

        assert result["caption"] == mock_response["caption"]
        assert result["hook"] == mock_response["hook"]
        assert result["cta"] == mock_response["cta"]
        assert result["post_text"] == mock_response["post_text"]
        assert result["platform"] == "instagram"
        mock_llm.generate_json.assert_called_once()


# ─── Hashtag Generator Agent ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_hashtag_generator_agent():
    """Test that HashtagGeneratorAgent returns niche and broad hashtags."""
    mock_response = {
        "niche_hashtags": ["#AIautomation", "#TechFounder", "#StartupAI"],
        "broad_hashtags": ["#AI", "#Technology", "#Startup"],
    }

    with patch("agents.hashtag_generator.llm") as mock_llm:
        mock_llm.generate_json = AsyncMock(return_value=mock_response)

        from agents.hashtag_generator import HashtagGeneratorAgent
        agent = HashtagGeneratorAgent()
        result = await agent.run({
            "platform": "instagram",
            "topic": "AI automation",
        })

        assert len(result["niche_hashtags"]) == 3
        assert len(result["broad_hashtags"]) == 3
        assert "#AIautomation" in result["niche_hashtags"]


# ─── Review Agent ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_review_agent_approved():
    """Test that ReviewAgent approves high-quality content."""
    mock_response = {
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

    with patch("agents.review_agent.llm") as mock_llm:
        mock_llm.generate_json = AsyncMock(return_value=mock_response)

        from agents.review_agent import ReviewAgent
        agent = ReviewAgent()
        result = await agent.run({
            "platform": "instagram",
            "caption": "Great content",
            "hook": "Amazing hook",
            "cta": "Follow now!",
            "post_text": "Full post text here",
            "niche_hashtags": ["#test"],
            "broad_hashtags": ["#content"],
        })

        assert result["is_approved"] is True
        assert result["overall_score"] == 9
        assert result["issues"] == []


@pytest.mark.asyncio
async def test_review_agent_rejected():
    """Test that ReviewAgent rejects low-quality content."""
    mock_response = {
        "grammar_score": 4,
        "engagement_score": 3,
        "hook_score": 2,
        "compliance_score": 5,
        "overall_score": 3,
        "issues": ["Weak hook", "Grammar errors"],
        "improvements": ["Rewrite the hook", "Fix spelling"],
        "improved_text": "Improved version of the post",
        "is_approved": False,
    }

    with patch("agents.review_agent.llm") as mock_llm:
        mock_llm.generate_json = AsyncMock(return_value=mock_response)

        from agents.review_agent import ReviewAgent
        agent = ReviewAgent()
        result = await agent.run({
            "platform": "twitter",
            "caption": "bad content",
            "hook": "meh",
            "cta": "",
            "post_text": "blah",
            "niche_hashtags": [],
            "broad_hashtags": [],
        })

        assert result["is_approved"] is False
        assert result["overall_score"] == 3
        assert len(result["issues"]) == 2
