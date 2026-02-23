import asyncio
from dotenv import load_dotenv
load_dotenv()
from db.database import async_session
from orchestration.master_orchestrator import MasterOrchestrator
from brain.providers.ollama_provider import OllamaProvider

async def main():
    async with async_session() as session:
        user_id = "44fd15d5-06a0-4471-b119-faf5426ff115"
        
        llm = OllamaProvider()
        master = MasterOrchestrator(llm)
        response = await master.chat("What are the names of all the brands I manage?", user_id=user_id)
        print("\n=== FINAL RESPONSE ===")
        print(response)

if __name__ == "__main__":
    asyncio.run(main())
