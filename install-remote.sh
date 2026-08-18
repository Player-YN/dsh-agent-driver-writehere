#!/usr/bin/env sh
# Remote one-liner (after this repo is on GitHub):
#   curl -fsSL https://raw.githubusercontent.com/Player-YN/dsh-agent-driver-writehere/main/install-remote.sh | sh
#
#   WRITEHERE_PLUGIN=github:Player-YN/dsh-agent-driver-writehere sh
#
# Official loader only: `dsh plugin add`. This script is a thin wrapper.

set -eu
SPEC="${WRITEHERE_PLUGIN:-github:Player-YN/dsh-agent-driver-writehere}"
PROFILE="${WRITEHERE_PROFILE:-web}"

if ! command -v dsh >/dev/null 2>&1; then
  echo "dsh is not on PATH. Install DeepSeek Harness first, then rerun."
  exit 2
fi

echo "dsh plugin --profile $PROFILE add $SPEC"
dsh plugin --profile "$PROFILE" add "$SPEC"

HOME_DIR="${DSH_HOME:-$HOME/.dsh}"
PKG="$HOME_DIR/profiles/$PROFILE/node_modules/dsh-agent-driver-writehere"
SRC="$PKG/presets/article-editor"
DST="$HOME_DIR/.agent-presets/article-editor"
if [ -d "$SRC" ]; then
  mkdir -p "$(dirname "$DST")"
  cp -R "$SRC" "$DST"
  echo "Preset copied to $DST"
else
  echo "Plugin installed; copy presets/article-editor to $DST if the editor preset is missing."
fi

echo "Done. Start: dsh --profile $PROFILE   then pick article-editor"
