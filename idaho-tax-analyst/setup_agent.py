"""ONE-TIME SETUP - creates (or updates) the environment and agent in your Claude Console
account from the files in this folder, and saves their IDs to ids.json.

Run it again after editing agents/idaho-tax-analyst.md: the agent gets a new version
instead of a duplicate. (If you have the `ant` CLI, `ant apply` on the same two files
does the same thing - see README.md. Use one method or the other, not both.)

    pip install anthropic pyyaml
    export ANTHROPIC_API_KEY=sk-ant-...      # or `ant auth login`
    python setup_agent.py
"""

import json
from pathlib import Path

import anthropic
import yaml

HERE = Path(__file__).parent
AGENT_FILE = HERE / "agents" / "idaho-tax-analyst.md"
ENV_FILE = HERE / "environments" / "idaho-tax-analyst-env.yaml"
IDS_FILE = HERE / "ids.json"


def load_agent_file(path: Path) -> dict:
    """YAML frontmatter = agent config, Markdown body = system prompt."""
    text = path.read_text()
    _, frontmatter, body = text.split("---\n", 2)
    config = yaml.safe_load(frontmatter)
    config["system"] = body.strip()
    return config


def main() -> None:
    client = anthropic.Anthropic()
    ids = json.loads(IDS_FILE.read_text()) if IDS_FILE.exists() else {}

    env_config = yaml.safe_load(ENV_FILE.read_text())
    if "environment_id" in ids:
        env = client.beta.environments.update(ids["environment_id"], **env_config)
        print(f"Updated environment {env.id}")
    else:
        env = client.beta.environments.create(**env_config)
        ids["environment_id"] = env.id
        print(f"Created environment {env.id}")
    IDS_FILE.write_text(json.dumps(ids, indent=2) + "\n")

    agent_config = load_agent_file(AGENT_FILE)
    if "agent_id" in ids:
        current = client.beta.agents.retrieve(ids["agent_id"])
        agent = client.beta.agents.update(ids["agent_id"], version=current.version, **agent_config)
        print(f"Updated agent {agent.id} -> version {agent.version}")
    else:
        agent = client.beta.agents.create(**agent_config)
        ids["agent_id"] = agent.id
        print(f"Created agent {agent.id} (version {agent.version})")
    IDS_FILE.write_text(json.dumps(ids, indent=2) + "\n")

    print(f"\nSaved IDs to {IDS_FILE.name}. View the agent at https://platform.claude.com/agents")


if __name__ == "__main__":
    main()
