"""
Zaytri — Agent 1: Content Creator Agent
Generates social media content (caption, hook, CTA, post text) using LLM.
"""

from typing import Any, Dict
from agents.base_agent import BaseAgent
from brain.llm_router import get_llm
from brain.prompts import CONTENT_CREATOR_SYSTEM, CONTENT_CREATOR_PROMPT


class ContentCreatorAgent(BaseAgent):
    """
    Agent 1 — Content Creator

    Input:  { topic, platform, tone }
    Output: { caption, hook, cta, post_text }
    """

    def __init__(self):
        super().__init__("ContentCreator")

    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        self.log_start(input_data)

        topic = input_data["topic"]
        platform = input_data["platform"]
        tone = input_data.get("tone", "professional")

        prompt = CONTENT_CREATOR_PROMPT.format(
            topic=topic,
            platform=platform,
            tone=tone,
        )

        try:
            result = await get_llm("content_creator").generate_json(
                prompt=prompt,
                system_prompt=CONTENT_CREATOR_SYSTEM,
                temperature=0.8,
            )

            output = {
                "caption": result.get("caption", ""),
                "hook": result.get("hook", ""),
                "cta": result.get("cta", ""),
                "post_text": result.get("post_text", ""),
                "topic": topic,
                "platform": platform,
                "tone": tone,
            }

            self.log_complete(output)
            return output

        except Exception as e:
            self.log_error(e)
            raise
