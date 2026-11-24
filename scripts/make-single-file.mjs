#!/usr/bin/env node
/**
 * Turns the static export into ONE portable .html file: every script, stylesheet
 * and font is inlined, so the app runs from a zip, a download, an email
 * attachment or a sandboxed preview — no server, no sibling files.
 *
 *   SINGLE_FILE=1 REL_ASSETS=1 next build && node scripts/make-single-file.mjs
 *   (or just: npm run build:single)
 *
 * Output: portfolio-forge.html
 */
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, 'out');
const indexPath = join(out, 'index.html');
const target = join(root, 'portfolio-forge.html');

if (!existsSync(indexPath)) {
  console.error('✗ no out/index.html — run the build first');
  process.exit(1);
}

const read = (href) => {
  const clean = href.replace(/^\.?\//, '').replace(/^_next\//, '_next/');
  const file = join(out, clean);
  if (!existsSync(file)) return null;
  return readFileSync(file, 'utf8');
};

let html = readFileSync(indexPath, 'utf8');
let jsCount = 0;
let cssCount = 0;

// 1. inline <link rel="stylesheet"> and any preload/prefetch of assets
html = html.replace(/<link[^>]*rel="(?:stylesheet|preload|prefetch|modulepreload)"[^>]*>/g, (tag) => {
  const href = (tag.match(/href="([^"]+)"/) || [])[1];
  if (!href || !/\.css(?:$|\?)/.test(href)) return '';
  const css = read(href);
  if (css === null) return tag;
  cssCount += 1;
  return `<style data-inlined="${href.replace(/.*\//, '')}">${css.replace(/<\/style/gi, '<\\/style')}</style>`;
});

// 2. inline external scripts, preserving order and execution flags
html = html.replace(/<script([^>]*)\ssrc="([^"]+)"([^>]*)><\/script>/g, (tag, pre, src, post) => {
  const js = read(src);
  if (js === null) return tag;
  jsCount += 1;
  // inline scripts cannot be async/defer without changing semantics; the bundle
  // already self-executes in order, so strip those attributes.
  const safe = (pre + post).replace(/\s(async|defer|nonce|integrity|crossorigin)(="[^"]*")?/g, '');
  return `<script${safe} data-inlined="${src.replace(/.*\//, '')}">${js.replace(/<\/script/gi, '<\\/script')}</script>`;
});

// 3. inline the preloaded theme fonts as data URIs (used by the studio UI)
html = html.replace(/url\((['"]?)\.?\/?fonts\/([a-z-]+\.woff2)\1\)/g, (m, q, file) => {
  const bufPath = join(root, 'public', 'fonts', file);
  if (!existsSync(bufPath)) return m;
  const b64 = readFileSync(bufPath).toString('base64');
  return `url(data:font/woff2;base64,${b64})`;
});

// 4. no leftover external references except the user's own links
html = html
  .replace(/<link[^>]*rel="(?:preload|prefetch|preconnect)"/g, '')
  .replace(/<link[^>]*rel="icon"[^>]*>/g, '');

writeFileSync(target, html);

const kb = Math.round(statSync(target).size / 1024);
const leftovers = (html.match(/(?:src|href)="\.?\/?_next\/[^"]+"/g) || []).length;

console.log(`✓ portfolio-forge.html — ${kb} KB (${jsCount} scripts + ${cssCount} stylesheets inlined)`);
if (leftovers) {
  console.log(`! ${leftovers} _next reference(s) survived — usually harmless (preloads), but check the browser console`);
} else {
  console.log('  every asset inlined: open it by double-click, no server needed');
}
