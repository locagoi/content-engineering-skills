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
echo ""
echo "Then put your own values OUTSIDE this repo and point CONTENT_CONFIG_DIR at them:"
echo "  mkdir -p ~/my-content-config"
echo "  cp \"$REPO_ROOT/longtail.config.example.json\" ~/my-content-config/longtail.config.json"
echo "  export CONTENT_CONFIG_DIR=\"$HOME/my-content-config\"   # add to your shell profile"
echo ""
echo "Keeping the filled-in config outside the checkout is deliberate: a path outside the"
echo "tree is a property, .gitignore is only a promise that a git add -f breaks."
echo "Next: run /geo or /scan in Claude Code."
