#!/usr/bin/env bash
# Uploads Noto Sans KR TTF into Supabase Storage 'system-assets' bucket.
# Supabase local must be running.
set -euo pipefail

# Capture SERVICE_ROLE_KEY from the project directory before cd'ing elsewhere
# (supabase status derives the container name from the current working dir).
SERVICE="$(supabase status -o env | grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2)"
if [[ -z "$SERVICE" ]]; then
  echo "ERROR: SERVICE_ROLE_KEY not found. Is 'supabase start' running?" >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"

# Prefer fonts already installed on this Mac (system location)
SYS_REG="/System/Library/Fonts/Supplemental/NotoSansKR-Regular.otf"
SYS_REG2="/Library/Fonts/NotoSansKR-Regular.otf"
USER_REG="$HOME/Library/Fonts/NotoSansKR-Regular.otf"

REG_SRC=""
for c in "$SYS_REG" "$SYS_REG2" "$USER_REG"; do
  if [[ -f "$c" ]]; then REG_SRC="$c"; break; fi
done

if [[ -z "$REG_SRC" ]]; then
  echo "Downloading Noto Sans KR from upstream..."
  # notofonts/noto-cjk release artifacts
  curl -sSLf -o NotoSansKR-Regular.otf \
    "https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf"
  REG_SRC="$WORK/NotoSansKR-Regular.otf"
fi

# Bold variant is optional — fall back to regular if not available
SYS_BOLD="/System/Library/Fonts/Supplemental/NotoSansKR-Bold.otf"
BOLD_SRC=""
for c in "$SYS_BOLD" "/Library/Fonts/NotoSansKR-Bold.otf" "$HOME/Library/Fonts/NotoSansKR-Bold.otf"; do
  if [[ -f "$c" ]]; then BOLD_SRC="$c"; break; fi
done
if [[ -z "$BOLD_SRC" ]]; then
  curl -sSLf -o NotoSansKR-Bold.otf \
    "https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/KR/NotoSansKR-Bold.otf" \
    && BOLD_SRC="$WORK/NotoSansKR-Bold.otf" \
    || echo "bold not available, falling back to regular"
fi

upload() {
  local src="$1" dst="$2"
  echo "Uploading $src -> $dst"
  # x-upsert=true allows re-runs to overwrite existing objects (200 on both
  # initial upload and rerun). Without it Supabase Storage returns 400 on
  # duplicates and `curl -f` would abort the script.
  curl -sSLf -X POST "http://127.0.0.1:54321/storage/v1/object/system-assets/$dst" \
    -H "apikey: $SERVICE" \
    -H "Authorization: Bearer $SERVICE" \
    -H "Content-Type: font/otf" \
    -H "x-upsert: true" \
    --data-binary "@$src" \
    -o /dev/null -w "status=%{http_code}\n"
}

upload "$REG_SRC" fonts/NotoSansKR-Regular.ttf
if [[ -n "$BOLD_SRC" ]]; then
  upload "$BOLD_SRC" fonts/NotoSansKR-Bold.ttf
else
  # Bold missing → alias regular as bold so pdfmake vfs lookup succeeds
  upload "$REG_SRC" fonts/NotoSansKR-Bold.ttf
fi

echo "Done."
