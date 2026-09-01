#!/usr/bin/env bash
# Cross-platform Python launcher for AI log hooks.
# Tries python3 → python → py -3 on PATH; on Windows, falls back to common
# Python install locations because Git Bash launched by some hooks gets a
# stripped PATH that omits the Windows Python directory.
# Designed to be sourced or called as: bash scripts/_pyrun.sh <script> [args...]
#
# Exits 0 silently if no Python is found — hooks must never block the AI tool.
set -u

_py_ok() {
  # Windows Git Bash often exposes a WindowsApps python3 stub that fails.
  case "$1" in
    *WindowsApps*) return 1 ;;
  esac
  "$1" -c "import sys" >/dev/null 2>&1
}

_pick_py() {
  if command -v python3 >/dev/null 2>&1 && _py_ok python3; then
    echo python3
    return 0
  fi
  if command -v python >/dev/null 2>&1 && _py_ok python; then
    echo python
    return 0
  fi
  if command -v py >/dev/null 2>&1 && _py_ok py; then
    echo "py -3"
    return 0
  fi
  return 1
}

PY=$(_pick_py 2>/dev/null || true)
if [ -z "$PY" ]; then
  # PATH lookup failed — probe standard Windows install locations.
  shopt -s nullglob 2>/dev/null || true
  for cand in \
    /c/Users/*/AppData/Local/Programs/Python/Python*/python.exe \
    "/c/Program Files/Python"*/python.exe \
    "/c/Program Files (x86)/Python"*/python.exe \
    /c/Python*/python.exe; do
    if [ -x "$cand" ] && _py_ok "$cand"; then PY="$cand"; break; fi
  done
  shopt -u nullglob 2>/dev/null || true
  [ -n "$PY" ] || exit 0
fi

# shellcheck disable=SC2086
exec $PY "$@"
