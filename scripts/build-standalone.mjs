#!/usr/bin/env node
/**
 * Builds the whole studio into ONE portable HTML file (no Next.js runtime):
 *
 *   npm run build:single      →  portfolio-forge.html
 *
 * Everything (React, the markdown pipeline, the themes, the built Tailwind CSS
 * and the three theme fonts) is inlined, so the file runs from a zip, a
 * download, an email attachment or a sandboxed iframe — no server needed.
 *
 * Served versions of the app are still built by Next (`npm run build:docs`).
 */
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const tmp = join(root, '.standalone');
const target = join(root, 'portfolio-forge.html');

const step = (msg) => console.log(`→ ${msg}`);

/* 1. Tailwind CSS, built for the studio components ------------------------- */
step('building styles (tailwind)');
mkdirSync(tmp, { recursive: true });
const cssEntry = join(tmp, 'entry.css');
writeFileSync(cssEntry, '@tailwind utilities;\n@tailwind components;\n');
const cssOut = join(tmp, 'studio.css');
execSync(
  `npx tailwindcss -i "${cssEntry}" -o "${cssOut}" --content "./components/**/*.js,./app/**/*.js" --minify`,
  { cwd: root, stdio: 'pipe' }
);
const tailwindCss = readFileSync(cssOut, 'utf8');

/* Studio-only base styles (the parts of app/globals.css that target the app) */
const globals = readFileSync(join(root, 'app', 'globals.css'), 'utf8')
  .replace(/@tailwind[^;]+;/g, '')
  .replace(/@layer components \{[\s\S]*?\n\}/g, (block) => {
    // keep the component classes but drop the @apply-free wrapper
    return block.replace(/^@layer components \{/, '').replace(/\}$/, '');
  });
const studioCss = `${globals}\n${tailwindCss}`;

/* 2. JS bundle ------------------------------------------------------------ */
step('bundling app (esbuild)');
const jsOut = join(tmp, 'studio.js');
await build({
  entryPoints: [join(here, 'standalone', 'entry.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome100', 'firefox100', 'safari15'],
  jsx: 'automatic',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  outfile: jsOut,
  define: {
    'process.env.NEXT_PUBLIC_BASE_PATH': '""',
    'process.env.NEXT_PUBLIC_ASSET_PREFIX': '""',
    'process.env.NODE_ENV': '"production"',
  },
  loader: { '.js': 'jsx' },
});
const js = readFileSync(jsOut, 'utf8');

/* 3. fonts as data URIs --------------------------------------------------- */
step('inlining fonts');
const fontsDir = join(root, 'public', 'fonts');
let fontCss = '';
for (const file of readdirSync(fontsDir).filter((f) => f.endsWith('.woff2'))) {
  const family = file.startsWith('inter')
    ? 'Inter'
    : file.startsWith('jetbrains')
      ? 'JetBrains Mono'
      : 'Newsreader';
  const b64 = readFileSync(join(fontsDir, file)).toString('base64');
  fontCss += `@font-face{font-family:'${family}';font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2')}\n`;
}

/* 4. assemble ------------------------------------------------------------- */
step('assembling single file');
const boot = await import(join(root, 'lib', 'boot.js'));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Portfolio Forge — Markdown → developer portfolio</title>
<meta name="description" content="Paste a Markdown résumé, pick a theme, preview it live and publish it to GitHub Pages in one click." />
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c6cff"/><stop offset="1" stop-color="#2dd4bf"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#g)"/><path d="M18 44V20h10.5a7.5 7.5 0 0 1 0 15H24" fill="none" stroke="#0a0b10" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="44" cy="40" r="4.5" fill="#0a0b10"/></svg>`
)}" />
<style>${boot.BOOT_STYLES}</style>
<style id="pf-fonts-inline">${fontCss}</style>
<style>${studioCss.replace(/<\/style/gi, '<\\/style')}</style>
</head>
<body>
<div id="pf-root"></div>
${boot.BOOT_MARKUP}
<script>${boot.BOOT_SCRIPT.replace(/<\/script/gi, '<\\/script')}</script>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;

writeFileSync(target, html);
rmSync(tmp, { recursive: true, force: true });

const kb = Math.round(statSync(target).size / 1024);
// report only real external loads (bundler code fragments contain template strings)
const HEAD = html.split('<body')[0];
const external = (HEAD.match(/(?:src|href)="(?!data:|#)[^"]+"/g) || []).filter(
  (m) => !/mailto:|https?:\/\/(github|example|linkedin|aditi)/.test(m)
);

console.log(`\n✓ ${target.split('/').pop()} — ${kb} KB, single file`);
console.log(`  inlined: ${Math.round(studioCss.length / 1024)} KB css · ${Math.round(js.length / 1024)} KB js · ${Math.round(fontCss.length / 1024)} KB fonts`);
console.log(external.length ? `  ! ${external.length} external reference(s): ${external.slice(0, 4).join(', ')}` : '  no external references — open it by double-click');
