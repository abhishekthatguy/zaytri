
import asyncio
import logging
from orchestration.master_orchestrator import MasterOrchestrator
from brain.llm_router import llm_router
from db.database import init_db, async_session
import db.register_models  # Ensure models are registered

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_rag")

async def test_chat():
    await init_db()
    
    # Initialize orchestrator
    orchestrator = MasterOrchestrator(llm=llm_router.get_default_provider())
    
    user_id = "44fd15d5-06a0-4471-b119-faf5426ff115"
    message = "What are the strongest markets for Clawtbot?"
    
    print(f"\n[USER]: {message}")
    
    # Context controls to enable brand memory (RAG)
    context_controls = {
        "brand_memory": True,
        "calendar_context": False,
        "past_posts": False,
        "engagement_data": False
    }
    
    try:
        result = await orchestrator.chat(
            message=message,
            user_id=user_id,
            conversation_history=[],
            is_authenticated=True,
            context_controls=context_controls
        )
        
        print("\n[MASTER AGENT RESPONSE]:")
        print("-" * 50)
        print(result.get("response"))
        print("-" * 50)
        print(f"Intent: {result.get('intent')}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_chat())
