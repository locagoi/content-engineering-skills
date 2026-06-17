#!/usr/bin/env bash
# Install the GEO skills into ~/.claude/commands (macOS/Linux). Windows: use setup.ps1.
# Usage: ./setup.sh [symlink|copy]   (default: symlink — edits in the repo are live immediately)
set -euo pipefail

MODE="${1:-symlink}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$REPO_ROOT/skills"
TARGET_DIR="$HOME/.claude/commands"
mkdir -p "$TARGET_DIR"

count=0
for skill in "$SKILLS_DIR"/*.md; do
  name="$(basename "$skill")"
  target="$TARGET_DIR/$name"
  if [ -L "$target" ]; then
    rm -f "$target"
  elif [ -e "$target" ]; then
    backup="$target.bak-$(date +%Y%m%d-%H%M%S)"
    mv "$target" "$backup"
    echo "Backed up existing $name -> $(basename "$backup")"
  fi
  if [ "$MODE" = "copy" ]; then
    cp "$skill" "$target"; echo "Copied:  $name"
  else
    ln -s "$skill" "$target"; echo "Symlink: $name"
  fi
  count=$((count + 1))
done

echo ""
echo "Done. $count skills installed in $TARGET_DIR (mode: $MODE)."
echo "Set PROJECTS_DIR and clone this repo to \$PROJECTS_DIR/content-engineering-skills so skills find the bundled scripts."
echo "Next: run /geo or /scan in Claude Code."
