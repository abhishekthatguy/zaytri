import os
import sys

file_path = "db/settings_models.py"
with open(file_path, "r") as f:
    content = f.read()

if "model_used = Column" not in content:
    content = content.replace(
        "    intent = Column(String(50), nullable=True)  # Classified intent (assistant only)",
        """    intent = Column(String(50), nullable=True)  # Classified intent (assistant only)
    model_used = Column(String(100), nullable=True)
    token_cost = Column(Integer, nullable=True)"""
    )

with open(file_path, "w") as f:
    f.write(content)
print("patched db/settings_models.py")
