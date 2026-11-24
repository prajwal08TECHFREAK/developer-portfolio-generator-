#!/usr/bin/env node
/**
 * Post-processes the static export so the app also works when opened directly
 * from disk (file://…/index.html), inside a zip, or in any folder — no server,
 * no build step for the user.
 *
 *   REL_ASSETS=1 npm run build && npm run make:offline
 *
 * What it does:
 *  - merges preview/index.html into preview.html (exactly one level deep, so
 *    plain file:// navigation works),
 *  - points the "Open full screen" link at preview.html,
 *  - turns hashed icon URLs into ./icon.svg.
 *
 * Every replacement is anchored to a full attribute value and also handles the
 * JSON-escaped copies inside Next's inline flight payload, so no escaping breaks.
 */
import { copyFileSync, existsSync, readFileSync, rmSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'out');

if (!existsSync(join(out, 'index.html'))) {
  console.error('✗ no out/index.html — run `REL_ASSETS=1 npm run build` first');
  process.exit(1);
}

// 1. flatten preview/
const previewDir = join(out, 'preview');
if (existsSync(join(previewDir, 'index.html'))) {
  copyFileSync(join(previewDir, 'index.html'), join(out, 'preview.html'));
  rmSync(previewDir, { recursive: true, force: true });
}

// 2. rewrite links in every HTML file
const rewrite = (html) =>
  html
    // absolute next asset urls (safety net if a build emits them)
    .replace(/(?<=")\.?\/?_next\//g, './_next/')
    // "Open full screen" → flat file (also matches the value built in the JS bundle)
    // (only path-like values — never the bare "preview" tab key)
    .replace(/(?<=")(?:\/|\.\/)preview\/?(?=")/g, './preview.html')
    // hashed favicon → plain file (both raw and JSON-escaped forms)
    .replace(/(?<=")(?:\.?\/)?icon\.svg\?[0-9a-f]+/g, './icon.svg')
    .replace(/(?<=\\")\.?\/?icon\.svg\?[0-9a-f]+/g, './icon.svg');

let count = 0;
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(html|js)$/.test(entry)) continue;
    const before = readFileSync(full, 'utf8');
    const after = rewrite(before);
    if (after !== before) writeFileSync(full, after);
    if (entry.endsWith('.html')) count += 1;
  }
}
walk(out);

console.log(`✓ rewrote ${count} HTML file(s) + JS chunks for offline / file:// use`);
console.log('  open out/index.html directly, or serve the folder: npm run serve');
