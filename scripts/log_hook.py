#!/usr/bin/env python3
"""
Shared AI hook logger — works with Claude Code, Gemini CLI, Codex, Cursor, Copilot.
Reads JSON from stdin, normalizes to common format, appends to .ai-log/session.jsonl
"""
import json
import os
import shutil
import sys
import subprocess
from datetime import datetime, timezone, timedelta
from functools import lru_cache
from pathlib import Path

VN_TZ = timezone(timedelta(hours=7))
REPO_ROOT = Path(__file__).resolve().parent.parent

_WIN_GIT_CANDIDATES = (
    Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Git" / "cmd" / "git.exe",
    Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Git" / "bin" / "git.exe",
    Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Git" / "cmd" / "git.exe",
    Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Git" / "cmd" / "git.exe",
)


@lru_cache(maxsize=1)
def _git_exe() -> str | None:
    """Locate git even when Cursor's hook PATH omits Git for Windows."""
    found = shutil.which("git")
    if found:
        return found
    for cand in _WIN_GIT_CANDIDATES:
        if cand and cand.is_file():
            return str(cand)
    return None


def git(*args: str) -> str:
    exe = _git_exe()
    if not exe:
        return ""
    try:
        return subprocess.check_output(
            [exe, *args],
            cwd=REPO_ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        return ""


def detect_tool(data: dict) -> str:
    """Detect which AI tool sent this hook event.

    Priority:
      1. --tool=NAME CLI argument (cross-platform: works in cmd.exe, PowerShell, bash)
      2. AI_TOOL_NAME env var (legacy, bash-only when set inline)
      3. Heuristics from payload shape
    """
    for arg in sys.argv[1:]:
        if arg.startswith("--tool="):
            return arg.split("=", 1)[1].lower()
    tool_env = os.environ.get("AI_TOOL_NAME", "").lower()
    if tool_env:
        return tool_env
    # Heuristics. Cursor 3.x always includes transcript_path (sometimes a
    # real path), so Codex must be distinguished by lacking workspace_roots.
    event = data.get("hook_event_name", "")
    if data.get("workspace_roots") and event[:1].islower():
        return "cursor"
    if data.get("transcript_path") and "workspace_roots" not in data:
        return "codex"
    if event.startswith(("Before", "After", "Session", "Pre", "Notification")):
        return "gemini"
    if event[:1].islower():
        if "toolName" in data:
            return "copilot"
        return "cursor"
    if "hook_event_name" in data:
        return "claude"
    return "unknown"


def normalize(data: dict, tool: str) -> dict | None:
    """Normalize tool-specific payload to common log entry."""
    event = data.get("hook_event_name") or data.get("event", "")
    ts = datetime.now(VN_TZ).isoformat()

    # Prefer git origin; Cursor's hook PATH on Windows often omits Git, so
    # fall back to the repo folder name instead of dropping the event.
    origin = git("remote", "get-url", "origin")
    if origin:
        repo = origin.rstrip("/").split("/")[-1]
        if repo.endswith(".git"):
            repo = repo[:-4]
    else:
        repo = REPO_ROOT.name

    base = {
        "ts": ts,
        "tool": tool,
        "event": event,
        "session_id": (
            data.get("session_id") or
            data.get("conversation_id") or
            data.get("generation_id") or ""
        ),
        "model": data.get("model", ""),
        "repo": repo,
        "branch": git("rev-parse", "--abbrev-ref", "HEAD"),
        "commit": git("rev-parse", "--short", "HEAD"),
        "student": git("config", "user.email"),
    }

    if tool == "claude":
        prompt = ""
        # UserPromptSubmit: prompt is at top level
        if event == "UserPromptSubmit":
            prompt = data.get("prompt", "")[:1000]
        # PostToolUse: extract from tool_input
        elif isinstance(data.get("tool_input"), dict):
            prompt = data["tool_input"].get("prompt") or data["tool_input"].get("content") or ""
        base.update({
            "prompt": prompt,
            "tool_name": data.get("tool_name", ""),
            "tool_input": data.get("tool_input") if event != "UserPromptSubmit" else None,
            "tool_response": str(data.get("tool_response", ""))[:500],
        })

    elif tool == "gemini":
        if event == "BeforeAgent":
            prompt = data.get("prompt", "")[:1000]
            base.update({"prompt": prompt})
        else:
            req = data.get("request", {})
            contents = req.get("contents", [])
            prompt = ""
            for c in reversed(contents):
                for part in c.get("parts", []):
                    if part.get("text"):
                        prompt = part["text"][:1000]
                        break
                if prompt:
                    break
            resp = data.get("response", {})
            answer = ""
            try:
                answer = resp["candidates"][0]["content"]["parts"][0]["text"][:500]
            except Exception:
                pass
            base.update({"prompt": prompt, "response_summary": answer})

    elif tool == "codex":
        base.update({
            "prompt": data.get("prompt", "")[:1000],
            "turn_id": data.get("turn_id", ""),
            "transcript_path": data.get("transcript_path", ""),
        })

    elif tool == "cursor":
        base.update({
            "prompt": data.get("prompt", "")[:1000],
            "files_context": data.get("attachments", []),
        })

    elif tool == "copilot":
        base.update({
            "prompt": data.get("prompt", "")[:1000],
            "tool_name": data.get("toolName", ""),
            "tool_args": data.get("toolArgs"),
        })

    # Skip only true noise: no prompt AND no tool-specific payload (tool_input,
    # response_summary, tool_response, tool_args, files_context). Previously
    # this only checked `prompt`, which dropped Claude Bash/Edit events (their
    # tool_input has `command` / `file_path`, not `prompt` or `content`) and
    # any Gemini/Cursor/Copilot turn that carried context but no plain prompt.
    _PAYLOAD_KEYS = ("prompt", "tool_input", "response_summary",
                     "tool_response", "tool_args", "files_context")
    _LIFECYCLE_EVENTS = ("Stop", "stop", "SessionEnd", "sessionEnd", "AfterModel")
    has_payload = any(base.get(k) for k in _PAYLOAD_KEYS)
    if not has_payload and event not in _LIFECYCLE_EVENTS:
        return None

    return base


def _decode_stdin(raw: bytes) -> str:
    if not raw:
        return ""
    for enc in ("utf-8-sig", "utf-8", "utf-16", "utf-16-le"):
        try:
            text = raw.decode(enc).strip()
        except UnicodeDecodeError:
            continue
        if text:
            return text
    return raw.decode("utf-8", errors="replace").strip()


def _prompt_from_transcript(path: str) -> str:
    """Last user prompt in a Cursor agent transcript (JSONL)."""
    if not path:
        return ""
    p = Path(path)
    if not p.is_file():
        return ""
    last = ""
    try:
        with open(p, encoding="utf-8") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if obj.get("role") != "user":
                    continue
                parts = obj.get("message", {}).get("content", [])
                texts = []
                if isinstance(parts, list):
                    for part in parts:
                        if isinstance(part, dict) and part.get("type") == "text":
                            texts.append(part.get("text") or "")
                raw = "\n".join(texts)
                if "<user_query>" in raw:
                    raw = raw.split("<user_query>", 1)[1]
                    raw = raw.split("</user_query>", 1)[0]
                last = raw.strip()
    except OSError:
        return ""
    return last[:1000]


def _payload_from_cursor_env() -> dict | None:
    """Windows Cursor often fails to pipe hook JSON to stdin. Recover from env."""
    transcript = os.environ.get("CURSOR_TRANSCRIPT_PATH", "")
    prompt = _prompt_from_transcript(transcript)
    if not prompt:
        return None
    session = Path(transcript).stem if transcript else ""
    return {
        "hook_event_name": "beforeSubmitPrompt",
        "prompt": prompt,
        "session_id": session,
        "conversation_id": session,
        "model": "",
        "attachments": [],
        "workspace_roots": [os.environ.get("CURSOR_PROJECT_DIR", str(REPO_ROOT))],
        "user_email": os.environ.get("CURSOR_USER_EMAIL", ""),
        "transcript_path": transcript,
    }


def _is_cursor_invocation() -> bool:
    if any(a.split("=", 1)[-1] == "cursor" and a.startswith("--tool=") for a in sys.argv[1:]):
        return True
    return bool(os.environ.get("CURSOR_TRANSCRIPT_PATH") or os.environ.get("CURSOR_PROJECT_DIR"))


def _ack(status: str = "logged") -> None:
    print(json.dumps({"status": status, "continue": True}))


def main():
    # Hook payload is UTF-8 JSON on stdin. Cursor on Windows sometimes
    # delivers an empty pipe; fall back to CURSOR_TRANSCRIPT_PATH.
    raw = _decode_stdin(sys.stdin.buffer.read())
    data = None
    if raw:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = None
    if not isinstance(data, dict) and _is_cursor_invocation():
        data = _payload_from_cursor_env()
    if not isinstance(data, dict):
        _ack("skipped")
        sys.exit(0)

    tool = detect_tool(data)
    entry = normalize(data, tool)
    if not entry:
        _ack("skipped")
        sys.exit(0)

    student = entry.get("student") or data.get("user_email") or os.environ.get("CURSOR_USER_EMAIL", "")
    if student:
        entry["student"] = student

    log_dir = Path(os.environ.get("AI_LOG_DIR", REPO_ROOT / ".ai-log"))
    if not log_dir.is_absolute():
        log_dir = REPO_ROOT / log_dir
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / "session.jsonl"

    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    _ack("logged")


if __name__ == "__main__":
    main()
