#!/bin/sh
set -e

# Docker volumes may be owned by root on first mount — fix before dropping privileges.
mkdir -p /app/qdrant_db /app/data
chown -R appuser:appuser /app/qdrant_db /app/data

exec gosu appuser "$@"
