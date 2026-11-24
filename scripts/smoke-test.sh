#!/usr/bin/env bash
# Checks the static export, and optionally a served instance of it.
#
#   npm run build            # produces ./out
#   ./scripts/smoke-test.sh                     # inspect ./out only
#   ./scripts/smoke-test.sh http://localhost:3000   # also hit a running server
#
set -u

BASE="${1:-}"
PASS=0
FAIL=0
OUT="out"

ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; PASS=$((PASS+1)); }
bad()  { printf "  \033[31m✗\033[0m %s\n" "$1"; FAIL=$((FAIL+1)); }
head_() { printf "\n\033[1m%s\033[0m\n" "$1"; }

echo "Portfolio Forge — static build checks"

head_ "1. Export output exists"
if [ -d "$OUT" ]; then ok "./out present"; else bad "./out missing — run 'npm run build' first"; fi
for f in index.html 404.html .nojekyll preview.html; do
  if [ -f "$OUT/$f" ]; then ok "$f"; else bad "$f missing"; fi
done

head_ "2. Pages reference real assets"
node -e '
const fs = require("fs");
const path = require("path");
const out = "out";
const pages = ["index.html", "404.html", "preview.html"];
let bad = 0;
for (const p of pages) {
  const html = fs.readFileSync(path.join(out, p), "utf8");
  const refs = [...html.matchAll(/(?:src|href)="(\.?\/?_next\/[^"]+)"/g)].map((m) => m[1]);
  const missing = refs.filter((r) => !fs.existsSync(path.join(out, r.replace(/^\.?\//, ""))));
  if (!refs.length) { console.log("  \x1b[31m✗\x1b[0m " + p + " has no _next assets"); bad++; continue; }
  if (missing.length) { console.log("  \x1b[31m✗\x1b[0m " + p + " → missing " + missing.join(", ")); bad++; continue; }
  console.log("  \x1b[32m✓\x1b[0m " + p + " → " + refs.length + " assets resolve");
}
if (/\/api\//.test(fs.readFileSync(path.join(out, "index.html"), "utf8"))) { console.log("  \x1b[31m✗\x1b[0m app still references /api routes"); bad++; }
else console.log("  \x1b[32m✓\x1b[0m no server API references (fully static)");
process.exit(bad ? 1 : 0);
' && PASS=$((PASS+2)) || FAIL=$((FAIL+1))

head_ "2b. Prebuilt copy in docs/app"
for f in docs/app/index.html docs/app/preview.html docs/app/.nojekyll docs/.nojekyll index.html portfolio-forge.html; do
  if [ -f "$f" ]; then ok "$f"; else bad "$f missing — run 'npm run build:docs' / 'npm run build:single'"; fi
done
if grep -q 'portfolio-forge.html' index.html; then ok "root index.html opens the app"; else bad "root index.html redirect missing"; fi

head_ "2c. Single-file build is self-contained"
if grep -q 'id="pf-boot"' portfolio-forge.html; then ok "boot screen (logo + progress bar) present"; else bad "boot screen missing"; fi
if grep -q 'id="pf-fonts-inline"' portfolio-forge.html; then ok "fonts inlined"; else bad "fonts not inlined"; fi
if grep -qE '<script[^>]+src=' portfolio-forge.html; then bad "external <script src> left in single file"; else ok "no external scripts"; fi
if grep -qE '<link[^>]+stylesheet' portfolio-forge.html; then bad "external stylesheet left in single file"; else ok "no external stylesheets"; fi
if grep -q '_next/_next' -r docs/app/index.html docs/app/preview.html 2>/dev/null; then bad "double _next/ prefix in docs/app"; else ok "no broken asset prefixes"; fi

head_ "3. Build size"
size=$(du -sk "$OUT" 2>/dev/null | awk '{print $1}')
if [ "${size:-0}" -lt 8000 ]; then ok "export is ${size} KB (under 8 MB)"; else bad "export is ${size} KB — unexpectedly large"; fi

if [ -n "$BASE" ]; then
  head_ "4. Served instance"
  code=$(curl -s -L -o /tmp/pf_home.html -w "%{http_code}" "$BASE/")
  [ "$code" = "200" ] && ok "GET / → 200" || bad "GET / → $code"
  grep -q "Portfolio Forge" /tmp/pf_home.html && ok "app shell served" || bad "app shell missing"
  code=$(curl -s -L -o /dev/null -w "%{http_code}" "$BASE/preview.html")
  [ "$code" = "200" ] && ok "GET /preview.html → 200" || bad "GET /preview.html → $code"
  js=$(grep -o '/_next/static/chunks/[^"]*\.js' /tmp/pf_home.html | head -1)
  if [ -n "$js" ]; then
    code=$(curl -s -L -o /dev/null -w "%{http_code}" "$BASE$js")
    [ "$code" = "200" ] && ok "JS chunk served ($js)" || bad "JS chunk → $code"
  fi
fi

head_ "5. Markdown → site pipeline (offline)"
if node scripts/check-export.mjs > /tmp/pf_check.log 2>&1; then
  ok "$(tail -1 /tmp/pf_check.log | sed 's/\x1b\[[0-9;]*m//g')"
  PASS=$((PASS+1))
else
  bad "pipeline checks failed — see scripts/check-export.mjs output"
  tail -20 /tmp/pf_check.log
  FAIL=$((FAIL+1))
fi

printf "\n\033[1m%d passed, %d failed\033[0m\n" "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
