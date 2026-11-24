#!/usr/bin/env node
/**
 * Builds the studio app as a static site into docs/app, using the exact URL it
 * will be served from on GitHub Pages, so no relative-path guesswork is needed:
 *
 *   repo  <user>/portfolio-forge   ->  https://<user>.github.io/portfolio-forge/app/
 *   repo  <user>/<user>.github.io  ->  https://<user>.github.io/app/
 *
 * With "Settings → Pages → Deploy from a branch → main → /docs" this makes the
 * live app available from the same repository that holds the source.
 *
 *   npm run build:docs
 *
 * The base path is read from the git origin remote; pass it explicitly with
 *   BASE_PATH=/my-repo/app npm run build:docs
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, 'out');
const docs = join(root, 'docs');
const dest = join(docs, 'app');

function repoFromGit() {
  try {
    const url = execSync('git remote get-url origin', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    const m = url.match(/[/:]([^/:]+)\/([^/]+?)(?:\.git)?$/);
    if (!m) return null;
    return { owner: m[1], repo: m[2] };
  } catch {
    return null;
  }
}

const info = repoFromGit();
let basePath = process.env.BASE_PATH;
if (basePath === undefined) {
  if (info) basePath = info.repo === `${info.owner}.github.io` ? '/app' : `/${info.repo}/app`;
  else basePath = '';
  if (!info) {
    console.log('! no git origin remote found — building with no base path.');
    console.log('  Pass it explicitly for a project repo: BASE_PATH=/<repo>/app npm run build:docs');
  }
}

console.log(`→ building static export with basePath "${basePath || '(none)'}"`);
execSync('npm run build', { stdio: 'inherit', cwd: root, env: { ...process.env, BASE_PATH: basePath } });

if (!existsSync(join(out, 'index.html'))) {
  console.error('✗ build produced no out/index.html');
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(docs, { recursive: true });
cpSync(out, dest, { recursive: true });
cpSync(join(out, '.nojekyll'), join(docs, '.nojekyll'));

const pagesRoot = info ? `https://${info.owner}.github.io${info.repo === `${info.owner}.github.io` ? '' : `/${info.repo}`}` : 'https://<user>.github.io/<repo>';
console.log(`✓ app copied to docs/app`);
console.log(`  Pages source "main /docs" → live at ${pagesRoot}/app/`);
console.log(`  local rehearsal: npx serve . -l 3102 → http://localhost:3102${info ? (info.repo === `${info.owner}.github.io` ? '/docs/app/' : `/${info.repo}/app/`) : '/docs/app/'} (needs the folder layout to match)`);
