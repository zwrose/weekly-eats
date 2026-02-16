#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# worktree-remove.sh — Remove a git worktree and optionally its database
#
# Usage: ./scripts/worktree-remove.sh [branch-name]
#
# If no branch name is given, shows an interactive menu of existing worktrees.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_WORKTREE="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREE_BASE="$(cd "$MAIN_WORKTREE/.." && pwd)/weekly-eats-worktrees"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

get_worktrees() {
  # Returns non-main worktree paths, one per line
  git -C "$MAIN_WORKTREE" worktree list --porcelain \
    | grep "^worktree " \
    | sed 's/^worktree //' \
    | grep -v "^$MAIN_WORKTREE$"
}

get_branch_for_path() {
  local wt_path="$1"
  git -C "$MAIN_WORKTREE" worktree list --porcelain \
    | awk -v path="$wt_path" '
      /^worktree / { current_path = substr($0, 10) }
      /^branch / && current_path == path { print substr($0, 8); sub("refs/heads/", "", $0); print substr($0, 8) }
    ' | tail -1
}

# ---------------------------------------------------------------------------
# Determine which worktree to remove
# ---------------------------------------------------------------------------

TARGET_PATH=""

if [[ $# -ge 1 && "$1" != "--help" && "$1" != "-h" ]]; then
  BRANCH_NAME="$1"
  SAFE_NAME=$(echo "$BRANCH_NAME" | sed 's|[^a-zA-Z0-9._-]|-|g' | sed 's|--*|-|g' | sed 's|^-||;s|-$||')
  TARGET_PATH="$WORKTREE_BASE/$SAFE_NAME"

  if [[ ! -d "$TARGET_PATH" ]]; then
    echo "Error: No worktree found at $TARGET_PATH"
    echo ""
    echo "Existing worktrees:"
    get_worktrees | while IFS= read -r p; do echo "  $p"; done
    exit 1
  fi
else
  # Interactive menu
  mapfile -t WORKTREES < <(get_worktrees)

  if [[ ${#WORKTREES[@]} -eq 0 ]]; then
    echo "No worktrees to remove (only the main worktree exists)."
    exit 0
  fi

  echo "Select a worktree to remove:"
  echo ""
  for i in "${!WORKTREES[@]}"; do
    local_branch=$(get_branch_for_path "${WORKTREES[$i]}")
    printf "  %d) %s  (%s)\n" $((i + 1)) "${WORKTREES[$i]}" "${local_branch:-unknown}"
  done
  echo ""
  read -rp "Enter number (1-${#WORKTREES[@]}), or 'q' to quit: " choice

  if [[ "$choice" == "q" || "$choice" == "Q" ]]; then
    echo "Aborted."
    exit 0
  fi

  if ! [[ "$choice" =~ ^[0-9]+$ ]] || [[ "$choice" -lt 1 || "$choice" -gt ${#WORKTREES[@]} ]]; then
    echo "Invalid selection."
    exit 1
  fi

  TARGET_PATH="${WORKTREES[$((choice - 1))]}"
fi

# ---------------------------------------------------------------------------
# Safety check — refuse to remove main worktree
# ---------------------------------------------------------------------------

if [[ "$TARGET_PATH" == "$MAIN_WORKTREE" ]]; then
  echo "Error: Cannot remove the main worktree."
  exit 1
fi

# ---------------------------------------------------------------------------
# Extract info for confirmation
# ---------------------------------------------------------------------------

PORT="-"
DB_NAME="-"
if [[ -f "$TARGET_PATH/.env.local" ]]; then
  PORT=$(grep -oP 'NEXTAUTH_URL=http://localhost:\K[0-9]+' "$TARGET_PATH/.env.local" 2>/dev/null || echo "-")
  DB_NAME=$(grep -oP 'MONGODB_URI=mongodb://localhost:27017/\K[^\s]+' "$TARGET_PATH/.env.local" 2>/dev/null || echo "-")
fi

echo ""
echo "About to remove:"
echo "  Path:     $TARGET_PATH"
echo "  Port:     $PORT"
echo "  Database: $DB_NAME"
echo ""

read -rp "Remove this worktree? (y/N) " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# ---------------------------------------------------------------------------
# Optional: drop MongoDB database
# ---------------------------------------------------------------------------

if [[ "$DB_NAME" != "-" ]] && command -v mongosh &>/dev/null; then
  echo ""
  read -rp "Also drop MongoDB database '$DB_NAME'? (y/N) " drop_db
  if [[ "$drop_db" =~ ^[Yy]$ ]]; then
    echo "Dropping database '$DB_NAME'..."
    mongosh --quiet --eval "db.getSiblingDB('$DB_NAME').dropDatabase()" 2>/dev/null || {
      echo "Warning: Could not drop database (is MongoDB running?). You may need to drop it manually."
    }
  fi
elif [[ "$DB_NAME" != "-" ]]; then
  echo ""
  echo "Note: mongosh not found. Database '$DB_NAME' was NOT dropped."
  echo "To drop it manually: mongosh --eval \"db.getSiblingDB('$DB_NAME').dropDatabase()\""
fi

# ---------------------------------------------------------------------------
# Remove worktree
# ---------------------------------------------------------------------------

echo ""
echo "Removing worktree..."
git -C "$MAIN_WORKTREE" worktree remove "$TARGET_PATH" --force 2>/dev/null || {
  # If git worktree remove fails (dirty tree), force-remove the directory
  echo "Warning: git worktree remove failed. Cleaning up manually..."
  rm -rf "$TARGET_PATH"
}

git -C "$MAIN_WORKTREE" worktree prune

echo ""
echo "Worktree removed successfully."
echo ""
