"""Minimal client for a Claude Managed Agent.

Creates a session, opens the event stream, sends one user.message, and prints
the agent's reply as it streams. Exits when the session goes idle.

    pip install anthropic
    export ANTHROPIC_API_KEY=sk-ant-...
    python app.py "What are my 2026 Idaho estimated tax deadlines?"
"""

import os
import sys

import anthropic

AGENT_ID = os.environ.get("AGENT_ID", "agent_013f57xGQkpQKdFg2oKxsqSN")
ENVIRONMENT_ID = os.environ.get("ENVIRONMENT_ID", "env_0149iW6idQXLhdMHkZpt7d5X")


def run(client: anthropic.Anthropic, prompt: str) -> int:
    session = client.beta.sessions.create(agent=AGENT_ID, environment_id=ENVIRONMENT_ID)
    print(f"Session: https://platform.claude.com/workspaces/default/sessions/{session.id}\n", file=sys.stderr)

    # Open the stream before sending so no early events are missed.
    with client.beta.sessions.events.stream(session_id=session.id) as stream:
        client.beta.sessions.events.send(
            session_id=session.id,
            events=[{"type": "user.message", "content": [{"type": "text", "text": prompt}]}],
        )

        for event in stream:
            if event.type == "agent.message":
                for block in event.content:
                    if block.type == "text":
                        print(block.text, end="", flush=True)

            elif event.type in ("agent.tool_use", "agent.mcp_tool_use") and event.evaluated_permission == "ask":
                # A tool call is paused for approval. Nobody is watching this run, so deny it.
                client.beta.sessions.events.send(
                    session_id=session.id,
                    events=[{
                        "type": "user.tool_confirmation",
                        "tool_use_id": event.id,
                        "result": "deny",
                        "deny_message": "No one is available to approve this call; continue without it.",
                    }],
                )

            elif event.type == "session.error":
                print(f"\n[session error] {event}", file=sys.stderr)

            elif event.type == "session.status_idle":
                # requires_action means the agent is waiting on a confirmation (sent above); keep streaming.
                if event.stop_reason.type == "requires_action":
                    continue
                print()
                return 0 if event.stop_reason.type == "end_turn" else 1

            elif event.type == "session.status_terminated":
                print("\n[session terminated]", file=sys.stderr)
                return 1

    print("\n[stream closed before the session went idle]", file=sys.stderr)
    return 1


def main() -> int:
    prompt = " ".join(sys.argv[1:]) or input("You: ").strip()
    if not prompt:
        print("No message given.", file=sys.stderr)
        return 2

    client = anthropic.Anthropic()
    try:
        return run(client, prompt)
    except anthropic.AuthenticationError:
        print("Authentication failed: set ANTHROPIC_API_KEY to a valid key.", file=sys.stderr)
    except anthropic.NotFoundError as e:
        print(f"Not found: check AGENT_ID / ENVIRONMENT_ID. ({e.message})", file=sys.stderr)
    except anthropic.BadRequestError as e:
        print(f"Bad request: {e.message}", file=sys.stderr)
    except anthropic.RateLimitError:
        print("Rate limited: wait a moment and try again.", file=sys.stderr)
    except anthropic.APIStatusError as e:
        print(f"API error {e.status_code}: {e.message}", file=sys.stderr)
    except anthropic.APIConnectionError:
        print("Could not reach the Anthropic API: check your network connection.", file=sys.stderr)
    except TypeError as e:
        # Raised by the SDK before any request when no credential is configured at all.
        if "authentication" not in str(e):
            raise
        print("No API key found: set ANTHROPIC_API_KEY (or run `ant auth login`).", file=sys.stderr)
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        return 130
    return 1


if __name__ == "__main__":
    sys.exit(main())
