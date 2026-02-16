#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# worktree-list.sh — List all git worktrees with port and database info
#
# Usage: ./scripts/worktree-list.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_WORKTREE="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Collect worktree info
# ---------------------------------------------------------------------------

# Header
printf "\n%-50s %-30s %-8s %s\n" "PATH" "BRANCH" "PORT" "DATABASE"
printf "%-50s %-30s %-8s %s\n" "----" "------" "----" "--------"

# Parse git worktree list output
git -C "$MAIN_WORKTREE" worktree list --porcelain | while IFS= read -r line; do
  case "$line" in
    "worktree "*)
      wt_path="${line#worktree }"
      ;;
    "branch "*)
      wt_branch="${line#branch refs/heads/}"
      ;;
    "HEAD "*)
      # skip
      ;;
    "detached")
      wt_branch="(detached)"
      ;;
    "")
      # End of entry — print it
      if [[ -n "${wt_path:-}" ]]; then
        port="-"
        db="-"
        if [[ -f "$wt_path/.env.local" ]]; then
          port=$(grep -oP 'NEXTAUTH_URL=http://localhost:\K[0-9]+' "$wt_path/.env.local" 2>/dev/null || echo "-")
          db=$(grep -oP 'MONGODB_URI=mongodb://localhost:27017/\K[^\s]+' "$wt_path/.env.local" 2>/dev/null || echo "-")
        fi
        printf "%-50s %-30s %-8s %s\n" "$wt_path" "${wt_branch:-unknown}" "$port" "$db"
      fi
      wt_path=""
      wt_branch=""
      ;;
  esac
done

echo ""
