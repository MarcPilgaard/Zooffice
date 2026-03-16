#!/bin/bash
set -e

REPO_URL="${ZOOFFICE_REPO:-https://github.com/MarcPilgaard/Zooffice.git}"

# Clone the repo if workspace is empty
if [ ! -d "/workspace/.git" ]; then
  echo "[entrypoint] Cloning $REPO_URL into /workspace..."
  git clone "$REPO_URL" /workspace
  cd /workspace
  npm ci --ignore-scripts
else
  echo "[entrypoint] Repo already present, pulling latest..."
  cd /workspace
  git pull --ff-only || true
fi

# Configure git identity from agent name if provided
if [ -n "$ZOOFFICE_AGENT_NAME" ]; then
  git config user.name "$ZOOFFICE_AGENT_NAME"
  git config user.email "$ZOOFFICE_AGENT_NAME@zooffice.bot"
fi

# If GH_TOKEN is set, configure git to use it for HTTPS auth
if [ -n "$GH_TOKEN" ]; then
  git config credential.helper '!f() { echo "password=$GH_TOKEN"; }; f'
fi

exec zooffice client connect "$@"
