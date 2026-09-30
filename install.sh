#!/usr/bin/env bash
# Sheetlingo installer: run `bash install.sh` in the repo folder (keeps your existing plugin id)
set -e
cd "$(dirname "$0")"
OLD_ID=""
[ -f .old-manifest.json ] && OLD_ID=$(node -p "require('./.old-manifest.json').id || ''")
if [ -n "$OLD_ID" ]; then
  node -e "const f='manifest.json',m=JSON.parse(require('fs').readFileSync(f));m.id=process.argv[1];require('fs').writeFileSync(f,JSON.stringify(m,null,2)+'\n')" "$OLD_ID"
  echo "✓ Kept plugin id: $OLD_ID"
  rm -f .old-manifest.json
fi
rm -f code.ts code.js ui.html eslint.config.js
rm -rf node_modules package-lock.json
npm install
npm run build
echo "✓ Done! In Figma: Plugins → Development → Sheetlingo"
