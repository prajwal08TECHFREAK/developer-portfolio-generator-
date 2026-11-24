#!/usr/bin/env node
/**
 * Offline checks for the browser bundle: parses the sample résumé, renders every
 * theme in both modes and exports the publishable file set — no server needed.
 *
 *   npm run check
 */
import { readFileSync } from 'node:fs';
import { compilePortfolio } from '../lib/markdown.js';
import { renderDocument } from '../lib/render.js';
import { exportFiles, publishFiles } from '../lib/publish-files.js';
import { THEMES } from '../lib/themes.js';

const sample = readFileSync(new URL('../examples/sample-resume.md', import.meta.url), 'utf8');

let pass = 0;
let fail = 0;
const ok = (m) => {
  console.log(`  \x1b[32m✓\x1b[0m ${m}`);
  pass += 1;
};
const bad = (m) => {
  console.log(`  \x1b[31m✗\x1b[0m ${m}`);
  fail += 1;
};
const head = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);

head('1. Parse');
const data = compilePortfolio(sample, {});
data.profile.name === 'Aditi Sharma' ? ok('front matter name') : bad(`name was ${data.profile.name}`);
const kinds = Object.fromEntries(data.sections.map((s) => [s.id, s.kind]));
const expected = { about: 'about', skills: 'skills', projects: 'projects', experience: 'experience', education: 'education', contact: 'contact' };
const wrong = Object.entries(expected).filter(([id, k]) => kinds[id] !== k);
wrong.length === 0 ? ok(`${data.sections.length} sections classified`) : bad(`misclassified ${JSON.stringify(wrong)}`);

head('2. Render all themes × modes');
for (const theme of THEMES) {
  for (const mode of ['light', 'dark']) {
    const html = renderDocument(data, { themeId: theme.id, mode });
    const good =
      html.startsWith('<!doctype html>') &&
      html.includes(`data-theme="${theme.id}"`) &&
      html.includes(`data-mode="${mode}"`) &&
      !/<script[^>]+src=/.test(html) &&
      !/<link[^>]+stylesheet/.test(html) &&
      html.length > 8000;
    good ? ok(`${theme.id} / ${mode} (${html.length} bytes, self-contained)`) : bad(`${theme.id} / ${mode}`);
  }
}

head('3. Options');
const html2 = renderDocument(compilePortfolio(sample, { sectionOrder: ['skills', 'about'], hidden: { education: true }, titles: { projects: 'Selected Work' } }), {
  themeId: 'minimal',
  accent: '#ff0000',
  numberHeadings: true,
});
html2.includes('Selected Work') ? ok('rename') : bad('rename');
!html2.includes('id="education"') ? ok('hidden section dropped') : bad('hidden section rendered');
/--accent:#ff0000/.test(html2) ? ok('accent override') : bad('accent override');
html2.indexOf('Skills') < html2.indexOf('About') ? ok('custom order') : bad('custom order');

head('4. Exports');
const files = exportFiles({ html: renderDocument(data, {}), markdown: sample, options: {} });
const need = ['index.html', 'portfolio.md', 'README.md', '.gitignore', '.github/workflows/deploy.yml'];
const missing = need.filter((f) => !files[f]);
missing.length === 0 ? ok(`site bundle: ${Object.keys(files).length} files`) : bad(`missing ${missing.join(', ')}`);
const pub = publishFiles({ markdown: sample, options: { name: 'Aditi Sharma' } });
Object.keys(pub).length === 4 ? ok('publish bundle: 4 files') : bad('publish bundle');

head('5. Edge cases');
const noFm = compilePortfolio('# Jane Doe\n\nText.\n\n## Skills\n- Go\n', {});
noFm.profile.name === 'Jane Doe' ? ok('H1 fallback for name') : bad(`H1 fallback (${noFm.profile.name})`);
const gfm = renderDocument(compilePortfolio('## Writing\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] done\n', {}), {});
gfm.includes('<table>') && gfm.includes('type="checkbox"') ? ok('GFM tables + task lists') : bad('GFM features');
const empty = renderDocument(compilePortfolio('', {}), {});
empty.includes('<html') ? ok('empty markdown renders a page') : bad('empty markdown');

console.log(`\n\x1b[1m${pass} passed, ${fail} failed\x1b[0m`);
process.exit(fail === 0 ? 0 : 1);
