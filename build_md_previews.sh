#!/bin/zsh
set -euo pipefail

ROOT="/Users/bradygeorgen/Documents/workspace/temporal"
cd "$ROOT"

command -v pandoc >/dev/null 2>&1 || {
  echo "pandoc not found. Install with: brew install pandoc" >&2
  exit 1
}

CSS_FILE="$ROOT/md.css"
cat > "$CSS_FILE" <<'CSS'
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, serif; color:#0f172a; line-height:1.7; max-width:84ch; margin:0 auto; padding:1rem; }
h1,h2,h3,h4{font-weight:700;margin-top:1.3em;margin-bottom:.5em}
h1{font-size:1.9rem;border-bottom:1px solid #e2e8f0;padding-bottom:.25rem}
h2{font-size:1.45rem;color:#1f2937}
h3{font-size:1.2rem;color:#334155}
p,li{font-size:1rem}
CSS

generate() {
  local in_file="$1" out_file="$2"
  pandoc "$in_file" -s --self-contained -c "$CSS_FILE" -o "$out_file"
}

generate temporal_wake_screenplay.md screenplay.html
generate temporal_wake_novel.md      novel.html
generate temporal_wake_outline.md    outline.html

echo "Generated: screenplay.html novel.html outline.html"

