#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# worktree-create.sh — Create an isolated git worktree for parallel development
#
# Usage: ./scripts/worktree-create.sh <branch-name> [--no-install] [--empty]
#
# Creates a worktree at ../weekly-eats-worktrees/<branch>/ with:
#   - Unique dev server port (auto-assigned from 3001+)
#   - Unique MongoDB database (weekly-eats-<branch>), cloned from main
#   - Its own node_modules and .next directories
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_WORKTREE="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREE_BASE="$(cd "$MAIN_WORKTREE/.." && pwd)/weekly-eats-worktrees"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

usage() {
  echo "Usage: $(basename "$0") <branch-name> [--no-install] [--empty]"
  echo ""
  echo "Creates a git worktree with isolated port, database, and dependencies."
  echo "By default, the main database is cloned so the worktree has sample data."
  echo ""
  echo "Options:"
  echo "  --no-install   Skip npm install (you can run it later manually)"
  echo "  --empty        Start with an empty database (indexes only, no data)"
  echo ""
  echo "Examples:"
  echo "  $(basename "$0") feature/shopping-cart"
  echo "  $(basename "$0") fix/login-bug --no-install"
  echo "  $(basename "$0") feature/new-feature --empty"
  exit 1
}

sanitize_branch() {
  # Convert branch name to safe directory/database name
  echo "$1" | sed 's|[^a-zA-Z0-9._-]|-|g' | sed 's|--*|-|g' | sed 's|^-||;s|-$||'
}

find_next_port() {
  local used_ports=()

  # Collect ports from main worktree
  if [[ -f "$MAIN_WORKTREE/.env.local" ]]; then
    local main_port
    main_port=$(grep -oP 'NEXTAUTH_URL=http://localhost:\K[0-9]+' "$MAIN_WORKTREE/.env.local" 2>/dev/null || echo "3000")
    used_ports+=("$main_port")
  fi

  # Collect ports from all existing worktrees
  if [[ -d "$WORKTREE_BASE" ]]; then
    while IFS= read -r env_file; do
      local port
      port=$(grep -oP 'NEXTAUTH_URL=http://localhost:\K[0-9]+' "$env_file" 2>/dev/null || true)
      if [[ -n "$port" ]]; then
        used_ports+=("$port")
      fi
    done < <(find "$WORKTREE_BASE" -maxdepth 2 -name ".env.local" 2>/dev/null)
  fi

  # Find first unused port starting from 3001
  local next_port=3001
  while true; do
    local in_use=false
    for p in "${used_ports[@]}"; do
      if [[ "$p" == "$next_port" ]]; then
        in_use=true
        break
      fi
    done
    if [[ "$in_use" == false ]]; then
      echo "$next_port"
      return
    fi
    next_port=$((next_port + 1))
  done
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

BRANCH_NAME=""
SKIP_INSTALL=false
EMPTY_DB=false

for arg in "$@"; do
  case "$arg" in
    --no-install)
      SKIP_INSTALL=true
      ;;
    --empty)
      EMPTY_DB=true
      ;;
    --help|-h)
      usage
      ;;
    *)
      if [[ -z "$BRANCH_NAME" ]]; then
        BRANCH_NAME="$arg"
      else
        echo "Error: Unexpected argument '$arg'"
        usage
      fi
      ;;
  esac
done

if [[ -z "$BRANCH_NAME" ]]; then
  echo "Error: Branch name is required."
  echo ""
  usage
fi

# ---------------------------------------------------------------------------
# Validate environment
# ---------------------------------------------------------------------------

if [[ ! -f "$MAIN_WORKTREE/.env.local" ]]; then
  echo "Error: $MAIN_WORKTREE/.env.local not found."
  echo "The main worktree's .env.local is used as a template for new worktrees."
  exit 1
fi

# ---------------------------------------------------------------------------
# Set up names and paths
# ---------------------------------------------------------------------------

SAFE_NAME=$(sanitize_branch "$BRANCH_NAME")
WORKTREE_PATH="$WORKTREE_BASE/$SAFE_NAME"
DB_NAME="weekly-eats-$SAFE_NAME"

# Check if worktree already exists at this path
if [[ -d "$WORKTREE_PATH" ]]; then
  echo "Error: Worktree already exists at $WORKTREE_PATH"
  echo ""
  echo "To remove it:  ./scripts/worktree-remove.sh $BRANCH_NAME"
  echo "To list all:   ./scripts/worktree-list.sh"
  exit 1
fi

# ---------------------------------------------------------------------------
# Handle branch existence
# ---------------------------------------------------------------------------

# Fetch latest refs
git -C "$MAIN_WORKTREE" fetch --quiet 2>/dev/null || true

BRANCH_EXISTS=false
if git -C "$MAIN_WORKTREE" show-ref --verify --quiet "refs/heads/$BRANCH_NAME" 2>/dev/null; then
  BRANCH_EXISTS=true
elif git -C "$MAIN_WORKTREE" show-ref --verify --quiet "refs/remotes/origin/$BRANCH_NAME" 2>/dev/null; then
  BRANCH_EXISTS=true
fi

if [[ "$BRANCH_EXISTS" == false ]]; then
  echo "Branch '$BRANCH_NAME' does not exist locally or on origin."
  read -rp "Create it from current HEAD? (y/N) " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
  CREATE_NEW_BRANCH=true
else
  CREATE_NEW_BRANCH=false
fi

# ---------------------------------------------------------------------------
# Find available port
# ---------------------------------------------------------------------------

PORT=$(find_next_port)

# ---------------------------------------------------------------------------
# Create worktree
# ---------------------------------------------------------------------------

echo ""
echo "Creating worktree..."
echo "  Branch:   $BRANCH_NAME"
echo "  Path:     $WORKTREE_PATH"
echo "  Port:     $PORT"
echo "  Database: $DB_NAME"
echo ""

mkdir -p "$WORKTREE_BASE"

if [[ "$CREATE_NEW_BRANCH" == true ]]; then
  git -C "$MAIN_WORKTREE" worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH"
else
  git -C "$MAIN_WORKTREE" worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
fi

# ---------------------------------------------------------------------------
# Generate .env.local
# ---------------------------------------------------------------------------

echo "Generating .env.local..."

# Read main .env.local and substitute port and database
sed \
  -e "s|MONGODB_URI=mongodb://localhost:27017/[^[:space:]]*|MONGODB_URI=mongodb://localhost:27017/$DB_NAME|" \
  -e "s|NEXTAUTH_URL=http://localhost:[0-9]*|NEXTAUTH_URL=http://localhost:$PORT|" \
  "$MAIN_WORKTREE/.env.local" > "$WORKTREE_PATH/.env.local"

# Add PORT so `next dev` listens on the correct port automatically
echo "PORT=$PORT" >> "$WORKTREE_PATH/.env.local"

# ---------------------------------------------------------------------------
# Clone database from main worktree
# ---------------------------------------------------------------------------

MAIN_DB=$(grep -oP 'MONGODB_URI=mongodb://localhost:27017/\K[^\s]+' "$MAIN_WORKTREE/.env.local" 2>/dev/null || echo "weekly-eats-dev")

if [[ "$EMPTY_DB" == true ]]; then
  echo "Skipping database clone (--empty flag). Database will have indexes only."
elif ! command -v mongodump &>/dev/null || ! command -v mongorestore &>/dev/null; then
  echo "Warning: mongodump/mongorestore not found. Skipping database clone."
  echo "Install mongodb-database-tools to enable automatic database cloning."
else
  echo "Cloning database '$MAIN_DB' → '$DB_NAME'..."
  DUMP_DIR=$(mktemp -d)
  if mongodump --db="$MAIN_DB" --out="$DUMP_DIR" --quiet 2>/dev/null; then
    mongorestore --db="$DB_NAME" "$DUMP_DIR/$MAIN_DB" --quiet --drop 2>/dev/null || {
      echo "Warning: mongorestore failed. Database may be empty."
    }
  else
    echo "Warning: mongodump failed (is MongoDB running?). Database will be empty."
  fi
  rm -rf "$DUMP_DIR"
fi

# ---------------------------------------------------------------------------
# Install dependencies
# ---------------------------------------------------------------------------

if [[ "$SKIP_INSTALL" == true ]]; then
  echo "Skipping npm install (--no-install flag)."
  echo "Run 'npm install' in the worktree when ready."
else
  echo "Installing dependencies (this may take a minute)..."
  (cd "$WORKTREE_PATH" && npm install)

  echo "Setting up database indexes..."
  (cd "$WORKTREE_PATH" && npm run setup-db)
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

echo ""
echo "========================================"
echo " Worktree created successfully!"
echo "========================================"
echo ""
echo "  Path:     $WORKTREE_PATH"
echo "  Branch:   $BRANCH_NAME"
echo "  Port:     $PORT"
echo "  Database: $DB_NAME"
echo "  URL:      http://localhost:$PORT"
echo ""
echo "Next steps:"
echo "  cd $WORKTREE_PATH"
echo "  npm run dev"
echo ""
