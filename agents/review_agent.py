"""
Zaytri — Agent 3: Review Agent
Reviews content for grammar, compliance, and engagement quality.
"""

from typing import Any, Dict
from agents.base_agent import BaseAgent
from brain.llm_router import get_llm
from brain.prompts import REVIEW_SYSTEM, REVIEW_PROMPT


class ReviewAgent(BaseAgent):
    """
    Agent 3 — Review Agent

    Input:  { platform, caption, hook, cta, post_text, hashtags }
    Output: { scores, issues, improvements, improved_text, is_approved }
    """

    def __init__(self):
        super().__init__("ReviewAgent")

    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        self.log_start(input_data)

        platform = input_data["platform"]
        caption = input_data.get("caption", "")
        hook = input_data.get("hook", "")
        cta = input_data.get("cta", "")
        post_text = input_data.get("post_text", "")

        # Combine hashtags
        niche = input_data.get("niche_hashtags", [])
        broad = input_data.get("broad_hashtags", [])
        hashtags = " ".join(niche + broad) if isinstance(niche, list) else str(niche)

        prompt = REVIEW_PROMPT.format(
            platform=platform,
            caption=caption,
            hook=hook,
            cta=cta,
            post_text=post_text,
            hashtags=hashtags,
        )

        try:
            result = await get_llm("review_agent").generate_json(
                prompt=prompt,
                system_prompt=REVIEW_SYSTEM,
                temperature=0.3,  # Lower temp for more consistent scoring
            )

            output = {
                "grammar_score": result.get("grammar_score", 0),
                "engagement_score": result.get("engagement_score", 0),
                "hook_score": result.get("hook_score", 0),
                "compliance_score": result.get("compliance_score", 0),
                "overall_score": result.get("overall_score", 0),
                "issues": result.get("issues", []),
                "improvements": result.get("improvements", []),
                "improved_text": result.get("improved_text"),
                "is_approved": result.get("is_approved", False),
            }

            self.log_complete(output)
            return output

        except Exception as e:
            self.log_error(e)
            raise
