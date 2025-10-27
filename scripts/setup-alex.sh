#!/bin/zsh
set -euo pipefail

ROOT="/Users/bradygeorgen/Documents/workspace/temporal"
cd "$ROOT"

# Load user's zshrc quietly to get ALEX_* vars
source ~/.zshrc >/dev/null 2>&1 || true

if [ -z "${ALEX_API_URL:-}" ] || [ -z "${ALEX_API_KEY:-}" ]; then
  echo "ALEX_API_URL or ALEX_API_KEY not found in ~/.zshrc" >&2
  echo "Add them and re-run this script." >&2
  exit 2
fi

# Ensure gh is authenticated
if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI not authenticated. Run: gh auth login" >&2
  exit 1
fi

# Set repo secrets
gh secret set ALEX_API_URL --body "$ALEX_API_URL"
gh secret set ALEX_API_KEY --body "$ALEX_API_KEY"

# Write local env for CLI usage
cat > .env.local <<EOF
ALEX_API_URL=$ALEX_API_URL
ALEX_API_KEY=$ALEX_API_KEY
# Optional local GitHub token for REST writes (otherwise gh auth is used):
# GITHUB_TOKEN=
EOF

echo "Alex secrets set in GitHub repo and .env.local written."

