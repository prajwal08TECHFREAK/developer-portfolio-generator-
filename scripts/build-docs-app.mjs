#!/usr/bin/env node
/**
 * Builds the studio as a portable static site into docs/app.
 *
 * The build uses relative asset URLs (REL_ASSETS=1), so the same folder works:
 *   • opened straight from disk   → file://…/docs/app/index.html
 *   • served from GitHub Pages    → https://<user>.github.io/<repo>/app/   (main /docs)
 *   • copied into any sub-folder  → no rebuild needed
 *
 *   npm run build:docs
 *
 * The zip in this repo already contains this folder prebuilt, so you only need
 * this command after changing the source.
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, 'out');
const docs = join(root, 'docs');
const dest = join(docs, 'app');

console.log('→ building static export with relative asset paths (works offline + on Pages)');
execSync('npm run build:offline', { stdio: 'inherit', cwd: root });

if (!existsSync(join(out, 'index.html'))) {
  console.error('✗ build produced no out/index.html');
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(docs, { recursive: true });
cpSync(out, dest, { recursive: true });
cpSync(join(out, '.nojekyll'), join(docs, '.nojekyll'));

const bytes = (() => {
  let total = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else total += statSync(full).size;
    }
  };
  walk(dest);
  return Math.round(total / 1024);
})();

console.log(`✓ docs/app ready (${bytes} KB)`);
console.log('  open locally:  docs/app/index.html  (or the index.html at the repo root)');
console.log('  GitHub Pages:  Settings → Pages → Deploy from a branch → main → /docs');
console.log('                 → https://<user>.github.io/<repo>/app/');
