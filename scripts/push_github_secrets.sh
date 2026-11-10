#!/usr/bin/env bash
# Copies the pipeline's secrets from .env into GitHub Actions and starts the
# first pipeline runs. Run by the owner: bash scripts/push_github_secrets.sh
set -euo pipefail
cd "$(dirname "$0")/.."
REPO=ferchichibaha7/thawline
get() { grep -E "^$1=" .env | head -1 | cut -d= -f2-; }
for name in DATABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  value="$(get "$name")"
  [ -n "$value" ] || { echo "$name is missing from .env"; exit 1; }
  printf '%s' "$value" | gh secret set "$name" --repo "$REPO"
done
gh variable set NEXT_PUBLIC_SUPABASE_URL --repo "$REPO" --body "$(get NEXT_PUBLIC_SUPABASE_URL)"
gh variable set CONTACT_EMAIL --repo "$REPO" --body "$(get CONTACT_EMAIL)"
gh workflow run weekly.yml --repo "$REPO"
gh workflow run monthly.yml --repo "$REPO"
echo "Secrets stored and pipeline runs started: https://github.com/$REPO/actions"
