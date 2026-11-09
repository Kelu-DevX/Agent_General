"""Chat with the Idaho tax analyst from your terminal.

    python chat.py                          # new conversation
    python chat.py --file jobber_export.csv --file receipts.pdf   # attach files for data review
    python chat.py --session sesn_...       # continue an earlier conversation

Each run is one session (the agent remembers everything within it). You can also
watch or reply to a session in the Console at the URL printed on start.
"""

import argparse
import json
import os
from pathlib import Path

import anthropic

HERE = Path(__file__).parent
ids = json.loads((HERE / "ids.json").read_text()) if (HERE / "ids.json").exists() else {}
AGENT_ID = os.environ.get("TAX_AGENT_ID", ids.get("agent_id"))
ENV_ID = os.environ.get("TAX_ENV_ID", ids.get("environment_id"))


def approve(event) -> bool:
    """A tool call the server could not judge on its own is waiting for you."""
    print(f"\n[approval needed] {event.name}: {json.dumps(event.input)[:500]}")
    return input("Allow? [y/N] ").strip().lower() == "y"


def run_turn(client: anthropic.Anthropic, session_id: str, text: str) -> None:
    # Open the stream first, then send, so no events are missed.
    with client.beta.sessions.events.stream(session_id=session_id) as stream:
        client.beta.sessions.events.send(
            session_id=session_id,
            events=[{"type": "user.message", "content": [{"type": "text", "text": text}]}],
        )
        for event in stream:
            if event.type == "agent.message":
                for block in event.content:
                    if block.type == "text":
                        print(block.text, end="", flush=True)
            elif event.type == "agent.tool_use":
                if event.name in ("web_search", "web_fetch"):
                    print(f"\n  ({event.name}: {json.dumps(event.input)[:160]})", flush=True)
                if event.evaluated_permission == "ask":
                    client.beta.sessions.events.send(
                        session_id=session_id,
                        events=[{
                            "type": "user.tool_confirmation",
                            "tool_use_id": event.id,
                            "result": "allow" if approve(event) else "deny",
                        }],
                    )
            elif event.type == "session.error":
                print(f"\n[session error] {event}")
            elif event.type == "session.status_idle":
                if event.stop_reason.type != "requires_action":
                    print()
                    return
            elif event.type == "session.status_terminated":
                print("\n[session ended]")
                return


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", help="continue an existing session ID")
    parser.add_argument("--file", action="append", default=[], help="file to attach (repeatable)")
    args = parser.parse_args()

    if not AGENT_ID or not ENV_ID:
        raise SystemExit("No agent/environment IDs. Run setup_agent.py first.")

    client = anthropic.Anthropic()

    if args.session:
        session_id = args.session
    else:
        resources = []
        for path in args.file:
            uploaded = client.files.upload(file=Path(path))
            resources.append({
                "type": "file",
                "file_id": uploaded.id,
                "mount_path": f"/{Path(path).name}",
            })
        session = client.beta.sessions.create(
            agent=AGENT_ID,
            environment_id=ENV_ID,
            title="Tax question",
            resources=resources,
        )
        session_id = session.id
        if resources:
            print("Attached: " + ", ".join(f"/mnt/session/uploads{r['mount_path']}" for r in resources))

    print(f"Session {session_id}")
    print(f"Watch in Console: https://platform.claude.com/workspaces/default/sessions/{session_id}")
    print("Type your question (blank line or Ctrl+C to quit).\n")

    try:
        while True:
            text = input("You: ").strip()
            if not text:
                break
            print("\nAnalyst: ", end="")
            run_turn(client, session_id, text)
            print()
    except (KeyboardInterrupt, EOFError):
        pass
    print(f"\nTo continue later: python chat.py --session {session_id}")


if __name__ == "__main__":
    main()
