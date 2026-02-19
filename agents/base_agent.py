"""
Zaytri — Base Agent (Abstract)
All agents inherit from this class.
"""

import logging
from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseAgent(ABC):
    """Abstract base class for all Zaytri agents."""

    def __init__(self, name: str):
        self.name = name
        self.logger = logging.getLogger(f"zaytri.agent.{name}")

    @abstractmethod
    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the agent's task.

        Args:
            input_data: Agent-specific input dictionary

        Returns:
            Agent-specific output dictionary
        """
        pass

    def log_start(self, input_data: Dict[str, Any]):
        self.logger.info(f"[{self.name}] Starting with input keys: {list(input_data.keys())}")

    def log_complete(self, output_data: Dict[str, Any]):
        self.logger.info(f"[{self.name}] Completed with output keys: {list(output_data.keys())}")

    def log_error(self, error: Exception):
        self.logger.error(f"[{self.name}] Error: {error}", exc_info=True)
