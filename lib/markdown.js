import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

export const DEFAULT_PROFILE = {
  name: 'Your Name',
  role: 'Developer',
  tagline: '',
  location: '',
  email: '',
  github: '',
  linkedin: '',
  website: '',
  avatar: '',
  resume: '',
};

/** Minimal, dependency-free YAML front-matter reader (flat key: value pairs). */
export function parseFrontMatter(raw = '') {
  const text = String(raw || '').replace(/^\uFEFF/, '');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { profile: { ...DEFAULT_PROFILE }, body: text };

  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line) || /^\s*-/.test(line)) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
    if (/^(true|yes)$/i.test(value)) value = true;
    else if (/^(false|no)$/i.test(value)) value = false;
    else if (value === '' || value === 'null' || value === '~') value = '';
    data[key] = value;
  }
  return { profile: { ...DEFAULT_PROFILE, ...data }, body: text.slice(m[0].length) };
}

/**
 * Split the markdown body into sections keyed by H2 headings.
 * Content before the first H2 becomes the `intro` section; an H1 (if present)
 * upgrades the display name. Each section keeps raw markdown and its heading id.
 */
export function splitSections(body = '') {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let current = { key: 'intro', title: 'Intro', md: [] };
  let h1 = null;
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (!inFence) {
      const h1m = line.match(/^#\s+(.+)$/);
      if (h1m && !h1) h1 = h1m[1].trim();
      const h2m = line.match(/^##\s+(.+)$/);
      if (h2m) {
        sections.push(current);
        const title = stripInline(h2m[1]).trim();
        current = { key: slugify(title), title, md: [] };
        continue;
      }
      if (h1 && current.key === 'intro' && /^#\s+/.test(line)) continue;
    }
    current.md.push(line);
  }
  sections.push(current);
  return {
    h1,
    sections: sections
      .map((s) => ({ ...s, md: s.md.join('\n').trim() }))
      .filter((s) => s.md.length > 0 || s.key !== 'intro'),
  };
}

export function slugify(s = '') {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s-]+/g, '-') || 'section'
  );
}

function stripInline(s = '') {
  return s.replace(/[*_`~]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
}

export function classify(key = '', title = '') {
  const k = `${key} ${title}`.toLowerCase();
  if (/skill|tech|stack|tool|expertise|language/.test(k)) return 'skills';
  if (/project|work sample|portfolio|build/.test(k)) return 'projects';
  if (/experience|employment|career|work history|timeline|job/.test(k)) return 'experience';
  if (/education|study|degree|academic/.test(k)) return 'education';
  if (/about|bio|summary|profile|intro|hello/.test(k)) return 'about';
  if (/contact|link|connect|reach|social/.test(k)) return 'contact';
  return 'generic';
}

/** Convert a markdown fragment to an HTML string (server or client). Use only trusted input. */
export function mdToHtml(md = '') {
  const file = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .processSync(md || '');
  return String(file);
}

/**
 * Turn a markdown hit into an ordered list item: { html, links: [{label,url}] }
 * Links are pulled out separately so themes can render them as buttons/chips.
 */
function listItems(html = '') {
  const items = [];
  const re = /<li>([\s\S]*?)<\/li>/g;
  let m;
  while ((m = re.exec(html))) items.push(re.exec);
  return items;
}

export function extractItemLinks(html = '') {
  const links = [];
  const re = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    links.push({ url: decodeEntities(m[1]), label: decodeEntities(stripTags(m[2])) });
  }
  return links;
}

export function stripTags(html = '') {
  return html.replace(/<[^>]*>/g, '');
}

function decodeEntities(s = '') {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

/**
 * Full compile pass: raw markdown -> normalized portfolio model.
 * options.sectionOrder / options.hidden let the UI reorder and hide sections.
 */
export function compilePortfolio(raw, options = {}) {
  const { profile: fmProfile, body } = parseFrontMatter(raw);
  const { h1, sections } = splitSections(body);
  const profile = { ...fmProfile, name: fmProfile.name || h1 || DEFAULT_PROFILE.name };

  const titles = options.titles || {};
  const compiled = sections.map((s) => {
    const html = mdToHtml(s.md);
    return {
      id: s.key,
      title: (titles[s.key] || '').trim() || s.title,
      kind: classify(s.key, s.title),
      md: s.md,
      html,
      links: extractItemLinks(html),
      hidden: (options.hidden && options.hidden[s.key]) === true,
    };
  });

  const order = Array.isArray(options.sectionOrder) ? options.sectionOrder : [];
  const withOrder = compiled
    .map((s, i) => ({ ...s, _i: i }))
    .sort((a, b) => {
      const posA = order.indexOf(a.id);
      const posB = order.indexOf(b.id);
      if (posA === -1 && posB === -1) return a._i - b._i;
      if (posA === -1) return 1;
      if (posB === -1) return -1;
      return posA - posB;
    });

  const hiddenMap = options.hidden || {};
  return {
    profile,
    sections: withOrder.map(({ _i, ...s }) => ({
      ...s,
      hidden: hiddenMap[s.id] !== undefined ? !!hiddenMap[s.id] : s.hidden,
    })),
    raw,
  };
}

export { listItems };
