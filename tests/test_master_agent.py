"""
Zaytri — Master Agent Tests
Tests intent classification, action execution, and conversation flow.
"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from agents.master_agent import MasterAgent, ActionExecutor, MASTER_SYSTEM_PROMPT


# ═══════════════════════════════════════════════════════════════════════════════
# System Prompt Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestSystemPrompt:
    """Validate the system prompt contains all required information."""

    def test_contains_all_intents(self):
        intents = [
            "assign_llm_key", "delete_llm_key", "test_provider",
            "assign_agent_model", "reset_agent_model", "switch_all_agents",
            "run_workflow", "update_cron", "get_system_status",
            "list_content", "approve_content", "delete_content",
            "list_providers", "list_agents", "get_settings",
            "help", "general_chat",
        ]
        for intent in intents:
            assert intent in MASTER_SYSTEM_PROMPT, f"Missing intent: {intent}"

    def test_contains_all_agents(self):
        agents = ["content_creator", "hashtag_generator", "review_agent",
                   "engagement_bot", "analytics_agent"]
        for agent in agents:
            assert agent in MASTER_SYSTEM_PROMPT, f"Missing agent: {agent}"

    def test_contains_all_providers(self):
        providers = ["ollama", "openai", "gemini", "anthropic", "groq"]
        for p in providers:
            assert p in MASTER_SYSTEM_PROMPT, f"Missing provider: {p}"

    def test_json_output_schema(self):
        assert '"intent"' in MASTER_SYSTEM_PROMPT
        assert '"params"' in MASTER_SYSTEM_PROMPT
        assert '"response"' in MASTER_SYSTEM_PROMPT

    def test_multilanguage_instruction(self):
        assert "SAME LANGUAGE" in MASTER_SYSTEM_PROMPT


# ═══════════════════════════════════════════════════════════════════════════════
# Response Parsing Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestResponseParsing:
    """Test the MasterAgent's JSON response parsing with various formats."""

    def setup_method(self):
        self.agent = MasterAgent()

    def test_parse_clean_json(self):
        raw = '{"intent": "help", "params": {}, "response": "Here you go!"}'
        result = self.agent._parse_response(raw)
        assert result["intent"] == "help"
        assert result["response"] == "Here you go!"

    def test_parse_json_in_code_block(self):
        raw = '```json\n{"intent": "run_workflow", "params": {"topic": "AI"}, "response": "Creating!"}\n```'
        result = self.agent._parse_response(raw)
        assert result["intent"] == "run_workflow"
        assert result["params"]["topic"] == "AI"

    def test_parse_json_with_surrounding_text(self):
        raw = 'Here is my analysis:\n{"intent": "list_content", "params": {}, "response": "Here are..."}'
        result = self.agent._parse_response(raw)
        assert result["intent"] == "list_content"

    def test_parse_fallback_to_general_chat(self):
        raw = "I don't understand what you're saying"
        result = self.agent._parse_response(raw)
        assert result["intent"] == "general_chat"
        assert "I don't understand" in result["response"]

    def test_parse_empty_string(self):
        result = self.agent._parse_response("")
        assert result["intent"] == "general_chat"


# ═══════════════════════════════════════════════════════════════════════════════
# Action Executor Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestActionExecutor:
    """Test ActionExecutor intent routing and error handling."""

    def setup_method(self):
        self.executor = ActionExecutor(user_id="test-user-123")

    @pytest.mark.asyncio
    async def test_unknown_intent_returns_error(self):
        result = await self.executor.execute("nonexistent_intent", {})
        assert result["success"] is False
        assert "Unknown intent" in result["message"]

    @pytest.mark.asyncio
    async def test_help_returns_success(self):
        result = await self.executor.execute("help", {})
        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_general_chat_returns_success(self):
        result = await self.executor.execute("general_chat", {})
        assert result["success"] is True

    @pytest.mark.asyncio
    @patch("agents.master_agent.async_session", create=True)
    async def test_assign_llm_key_missing_params(self):
        result = await self.executor.execute("assign_llm_key", {})
        assert result["success"] is False
        assert "required" in result["message"].lower()

    @pytest.mark.asyncio
    @patch("agents.master_agent.async_session", create=True)
    async def test_run_workflow_missing_topic(self):
        result = await self.executor.execute("run_workflow", {"platform": "instagram"})
        assert result["success"] is False
        assert "Topic" in result["message"] or "required" in result["message"].lower()


# ═══════════════════════════════════════════════════════════════════════════════
# Master Agent Chat Flow Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestMasterAgentChat:
    """Test the full chat flow with mocked LLM calls."""

    def setup_method(self):
        self.agent = MasterAgent()

    @pytest.mark.asyncio
    async def test_chat_with_help_intent(self):
        mock_llm = AsyncMock()
        mock_llm.generate = AsyncMock(return_value=json.dumps({
            "intent": "help",
            "params": {},
            "response": "I can help you with content creation, settings, and more!",
        }))

        with patch("agents.master_agent.get_llm", return_value=mock_llm):
            result = await self.agent.chat(
                message="What can you do?",
                user_id="test-user",
            )

        assert result["intent"] == "help"
        assert "help" in result["response"].lower() or "content" in result["response"].lower()
        assert result["action_success"] is True

    @pytest.mark.asyncio
    async def test_chat_with_system_status(self):
        mock_llm = AsyncMock()
        mock_llm.generate = AsyncMock(return_value=json.dumps({
            "intent": "get_system_status",
            "params": {},
            "response": "Here's your system status:",
        }))

        # Mock the health check and DB calls
        mock_provider = AsyncMock()
        mock_provider.health_check = AsyncMock(return_value=True)

        with patch("agents.master_agent.get_llm", return_value=mock_llm), \
             patch("agents.master_agent.ActionExecutor._handle_get_system_status") as mock_status:
            mock_status.return_value = {
                "success": True,
                "message": "Status ok",
                "data": {"ollama": "connected", "total_content": 5},
            }
            result = await self.agent.chat(
                message="Show system status",
                user_id="test-user",
            )

        assert result["intent"] == "get_system_status"
        assert result["action_success"] is True

    @pytest.mark.asyncio
    async def test_chat_with_conversation_history(self):
        mock_llm = AsyncMock()
        mock_llm.generate = AsyncMock(return_value=json.dumps({
            "intent": "general_chat",
            "params": {},
            "response": "Following up on our conversation...",
        }))

        history = [
            {"role": "user", "content": "Hello!"},
            {"role": "assistant", "content": "Hi there!"},
        ]

        with patch("agents.master_agent.get_llm", return_value=mock_llm):
            result = await self.agent.chat(
                message="Tell me more",
                user_id="test-user",
                conversation_history=history,
            )

        # Verify the prompt included conversation history
        call_args = mock_llm.generate.call_args
        assert "Hello!" in call_args.kwargs.get("prompt", "") or \
               "Hello!" in (call_args.args[0] if call_args.args else "")

    @pytest.mark.asyncio
    async def test_chat_llm_failure_fallback(self):
        mock_llm = AsyncMock()
        mock_llm.generate = AsyncMock(side_effect=Exception("LLM down"))

        with patch("agents.master_agent.get_llm", return_value=mock_llm):
            result = await self.agent.chat(
                message="Hello",
                user_id="test-user",
            )

        # Should fallback to general_chat
        assert result["intent"] == "general_chat"
        assert "try again" in result["response"].lower()

    @pytest.mark.asyncio
    async def test_chat_workflow_intent(self):
        mock_llm = AsyncMock()
        mock_llm.generate = AsyncMock(return_value=json.dumps({
            "intent": "run_workflow",
            "params": {"topic": "AI trends", "platform": "instagram", "tone": "casual"},
            "response": "Creating a post about AI trends!",
        }))

        with patch("agents.master_agent.get_llm", return_value=mock_llm), \
             patch("agents.master_agent.ActionExecutor._handle_run_workflow") as mock_wf:
            mock_wf.return_value = {
                "success": True,
                "message": "Content created!",
                "data": {"content_id": "abc123", "status": "reviewed"},
            }
            result = await self.agent.chat(
                message="Create a post about AI trends for Instagram",
                user_id="test-user",
            )

        assert result["intent"] == "run_workflow"
        assert result["action_success"] is True
        assert result["action_data"] is not None


# ═══════════════════════════════════════════════════════════════════════════════
# Integration Checks
# ═══════════════════════════════════════════════════════════════════════════════

class TestIntegration:
    """Verify the Master Agent integrates correctly with the system."""

    def test_master_agent_in_agent_ids(self):
        from brain.llm_router import AGENT_IDS
        assert "master_agent" in AGENT_IDS

    def test_master_agent_exported(self):
        from agents import MasterAgent
        assert MasterAgent is not None

    def test_action_executor_has_all_handlers(self):
        executor = ActionExecutor(user_id="test")
        expected = [
            "assign_llm_key", "delete_llm_key", "test_provider",
            "assign_agent_model", "reset_agent_model", "switch_all_agents",
            "run_workflow", "update_cron", "get_system_status",
            "list_content", "approve_content", "delete_content",
            "list_providers", "list_agents", "get_settings",
            "help", "general_chat",
        ]
        for intent in expected:
            handler = getattr(executor, f"_handle_{intent}", None)
            assert handler is not None, f"Missing handler: _handle_{intent}"
            assert callable(handler), f"Handler not callable: _handle_{intent}"
