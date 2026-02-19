"""
Zaytri — Agent 2: Hashtag Generator Agent
Generates niche and broad hashtags for social media posts.
"""

from typing import Any, Dict
from agents.base_agent import BaseAgent
from brain.llm_router import get_llm
from brain.prompts import HASHTAG_SYSTEM, HASHTAG_PROMPT


class HashtagGeneratorAgent(BaseAgent):
    """
    Agent 2 — Hashtag Generator

    Input:  { platform, topic }
    Output: { niche_hashtags: [...], broad_hashtags: [...] }
    """

    def __init__(self):
        super().__init__("HashtagGenerator")

    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        self.log_start(input_data)

        platform = input_data["platform"]
        topic = input_data["topic"]

        prompt = HASHTAG_PROMPT.format(
            platform=platform,
            topic=topic,
        )

        try:
            result = await get_llm("hashtag_generator").generate_json(
                prompt=prompt,
                system_prompt=HASHTAG_SYSTEM,
                temperature=0.7,
            )

            output = {
                "niche_hashtags": result.get("niche_hashtags", []),
                "broad_hashtags": result.get("broad_hashtags", []),
            }

            self.log_complete(output)
            return output

        except Exception as e:
            self.log_error(e)
            raise
