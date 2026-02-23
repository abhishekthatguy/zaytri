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
        user_id = input_data.get("user_id")
        brand = input_data.get("brand")

        # Compile Multi-tenant Brand RAG Context if user_id is provided
        rag_context = ""
        if user_id:
            from brain.rag import BrandResolverRAG
            rag = BrandResolverRAG(user_id=user_id)
            rag_context = await rag.build_context(
                topic=topic, 
                platform=platform, 
                assigned_tone=tone, 
                assigned_brand=brand
            )

        prompt = CONTENT_CREATOR_PROMPT.format(
            topic=topic,
            platform=platform,
            tone=tone,
        )

        # Inject RAG Context to prevent hallucinations and enforce brand identity
        if rag_context:
            prompt = prompt + f"\n\n{rag_context}"

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
