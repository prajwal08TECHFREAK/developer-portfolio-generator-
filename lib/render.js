import { mdToHtml, stripTags, extractItemLinks } from './markdown.js';
import { FONTS, getTheme } from './themes.js';

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

function decodeOnce(s = '') {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x26;/gi, '&')
    .replace(/&amp;/gi, '&');
}

function decode(s = '') {
  let out = String(s);
  for (let i = 0; i < 3; i += 1) {
    const next = decodeOnce(out);
    if (next === out) break;
    out = next;
  }
  return out;
}

function esc(s = '') {
  return decode(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attr(s = '') {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function listItems(html = '') {
  const items = [];
  const re = /<li>([\s\S]*?)<\/li>/g;
  let m;
  while ((m = re.exec(html))) {
    const inner = m[1];
    items.push({ html: inner, text: stripTags(inner).replace(/\s+/g, ' ').trim(), links: extractItemLinks(inner) });
  }
  return items;
}

function paras(md = '') {
  return md
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !/^([-*+]|\d+\.|#{1,6}|>|\||```)\s?/.test(p));
}

/** Split a section's markdown into ### blocks (falls back to the whole body). */
export function blocks(md = '', level = 3) {
  const marker = '#'.repeat(level) + ' ';
  const out = [];
  let cur = { title: '', md: [] };
  let inFence = false;
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (!inFence && line.startsWith(marker)) {
      if (cur.title || cur.md.join('').trim()) out.push({ title: cur.title, md: cur.md.join('\n') });
      cur = { title: stripTags(mdToHtml(line.slice(marker.length))).trim(), md: [] };
      continue;
    }
    cur.md.push(line);
  }
  if (cur.title || cur.md.join('').trim()) out.push({ title: cur.title, md: cur.md.join('\n') });
  return out.filter((b) => b.title || b.md.trim());
}

/**
 * Read a leading "role line" such as `**Role** · Company — *2023 – Present*`.
 * Only lines that actually look like a title/date line are treated as meta;
 * a plain descriptive sentence is left for the body.
 */
function splitMeta(md = '') {
  const lines = String(md).split('\n').filter((l) => l.trim());
  const first = (lines[0] || '').trim();
  const dateMatch = first.match(/\*([^*]*\d{4}[^*]*)\*/) || first.match(/(\b(?:19|20)\d{2}\b[^|]*)$/);
  const date = dateMatch ? stripTags(dateMatch[1] || dateMatch[0]).replace(/[*_`]/g, '').trim() : '';
  let head = (dateMatch ? first.replace(dateMatch[0], '') : first)
    .replace(/^[-*+]\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/\s*[·|@,–—-]\s*$/, '')
    .trim();

  const looksLikeTitle =
    !!date ||
    /\s[·|@]\s/.test(head) ||
    /\s[—–-]\s/.test(head) ||
    (head.length > 0 && head.length <= 64 && !/[.!?:]$/.test(head));

  if (!looksLikeTitle) return { role: '', org: '', date };

  const parts = head.split(/\s+[·|@—–-]\s+/);
  const role = stripTags(parts[0] || '').replace(/[*_`]/g, '').trim();
  const org = stripTags(parts.slice(1).join(' · ')).replace(/[*_`]/g, '').trim();
  return { role, org, date };
}

/** Remove bullets, tech lines and the repeated title/role line from a card body. */
function cleanCardBody(html = '', { role = '', org = '' } = {}) {
  let out = html
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/g, '')
    .replace(/<ul[^>]*>[\s\S]*?<\/ul>/g, '')
    .replace(/<ol[^>]*>[\s\S]*?<\/ol>/g, '')
    .replace(/<p>\s*(?:[-*+]|\d+\.)\s+[\s\S]*?<\/p>/g, '');
  if (role) {
    const firstPara = (out.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '';
    const firstPlain = stripTags(firstPara).replace(/\s+/g, ' ').trim();
    if (firstPlain && (firstPlain === role || firstPlain === org) && firstPlain.length < 90) {
      out = out.replace(/<p[^>]*>[\s\S]*?<\/p>/, '');
    }
  }
  return out.trim();
}

/* ------------------------------------------------------------------ */
/* section renderers                                                   */
/* ------------------------------------------------------------------ */

const chip = (t) => `<span class="chip">${esc(stripTags(t))}</span>`;
const btn = (label, url) =>
  `<a class="btn" href="${attr(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}<span aria-hidden="true">↗</span></a>`;

function renderSkills(section) {
  const items = listItems(mdToHtml(section.md));
  if (!items.length) return `<div class="prose">${mdToHtml(section.md)}</div>`;
  const groups = [];
  const loose = [];
  for (const it of items) {
    const m = it.text.match(/^([^:]{2,40}):\s*(.+)$/);
    if (m && /\*\*|__/.test(it.html)) {
      const vals = m[2].split(/[,/·|]/).map((v) => v.trim()).filter(Boolean);
      groups.push({ label: m[1].trim(), vals });
    } else {
      loose.push(it.text);
    }
  }
  let html = '';
  if (loose.length) html += `<div class="chips">${loose.map(chip).join('')}</div>`;
  if (groups.length)
    html += `<div class="skill-groups">${groups
      .map(
        (g) =>
          `<div class="skill-group"><div class="skill-label">${esc(g.label)}</div><div class="chips">${g.vals
            .map(chip)
            .join('')}</div></div>`
      )
      .join('')}</div>`;
  return html;
}

function renderCards(section) {
  const bs = blocks(section.md);
  if (bs.length <= 1 && !bs[0]?.title) return `<div class="prose">${mdToHtml(section.md)}</div>`;
  const cards = bs
    .map((b) => {
      const { role, org, date } = splitMeta(b.md);
      const title = b.title || role;
      const html = mdToHtml(b.md);
      const lis = listItems(html);
      const tech = lis
        .map((l) => l.text)
        .filter((t) => /^(tech|stack|built with|tools)\s*:/i.test(t))
        .flatMap((t) => t.replace(/^[^:]+:\s*/, '').split(/[,/·|]/))
        .map((t) => t.trim())
        .filter(Boolean);
      const links = extractItemLinks(html);
      const desc = cleanCardBody(html, { role, org });
      return `<article class="card">
  <div class="card-head">
    <h3 class="card-title">${esc(title)}</h3>
    ${date ? `<span class="card-date">${esc(date)}</span>` : ''}
  </div>
  ${org ? `<div class="card-sub">${esc(org)}</div>` : role && b.title && role.length < 56 && !/[.!?]$/.test(role) ? `<div class="card-sub">${esc(role)}</div>` : ''}
  <div class="prose card-body">${desc}</div>
  ${tech.length ? `<div class="chips chips-sm">${tech.map(chip).join('')}</div>` : ''}
  ${links.length ? `<div class="card-links">${links.map((l) => btn(l.label, l.url)).join('')}</div>` : ''}
</article>`;
    })
    .join('');
  return `<div class="cards">${cards}</div>`;
}

function renderTimeline(section) {
  const bs = blocks(section.md);
  if (bs.length <= 1 && !bs[0]?.title) return `<div class="prose">${mdToHtml(section.md)}</div>`;
  const rows = bs
    .map((b) => {
      const { role, org, date } = splitMeta(b.md);
      const html = mdToHtml(b.md)
        .replace(/<p>\s*<em>[^<]*(?:19|20)\d{2}[^<]*<\/em>\s*<\/p>/g, '')
        .replace(/<p>\s*(?:<strong>)?[^<]*(?:19|20)\d{2}[^<]*(?:<\/strong>)?\s*<\/p>/g, '')
        .replace(/<p>\s*(?:[-*+])\s+/g, '<p>');
      return `<li class="tl-item">
  <span class="dot" aria-hidden="true"></span>
  <div class="tl-main">
    <div class="tl-top">
      <h3 class="tl-role">${esc(b.title || role)}</h3>
      ${date ? `<span class="tl-date">${esc(date)}</span>` : ''}
    </div>
    ${org ? `<div class="tl-org">${esc(org)}</div>` : ''}
    <div class="prose">${html}</div>
  </div>
</li>`;
    })
    .join('');
  return `<ul class="timeline">${rows}</ul>`;
}

/* ------------------------------------------------------------------ */
/* shell + css                                                         */
/* ------------------------------------------------------------------ */

export function buildCss({ theme, mode, options }) {
  const t = theme[mode] || theme.light;
  const fontDisplay = FONTS[options.fontDisplay] || theme.display;
  const fontBody = FONTS[options.fontBody] || theme.body;
  const radius = options.radius === 'sharp' ? '2px' : options.radius === 'round' ? '22px' : theme.radius;
  const accent = options.accent || t.accent;
  const accent2 = options.accent2 || t.accent2;
  const density = options.density === 'compact' ? 0.82 : options.density === 'airy' ? 1.16 : 1;
  const width = options.width === 'wide' ? '1180px' : options.width === 'narrow' ? '780px' : '960px';

  return `:root{
  --bg:${t.bg};--surface:${t.surface};--surface-solid:${t.surfaceSolid};--text:${t.text};
  --muted:${t.muted};--border:${t.border};--accent:${accent};--accent2:${accent2};
  --shadow:${t.shadow};--glow:${t.glow};--radius:${radius};
  --font-display:${fontDisplay};--font-body:${fontBody};--font-mono:${theme.mono};
  --gap:calc(${(1.6 * density).toFixed(2)}rem);--pad:calc(${(1.35 * density).toFixed(2)}rem);
  --maxw:${width};color-scheme:${mode};
}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background-color:var(--bg);color:var(--text);font-family:var(--font-body);
  font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased;overflow-x:hidden}
img{max-width:100%;display:block}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
h1,h2,h3,h4{font-family:var(--font-display);line-height:1.18;margin:0}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 1.25rem}
.skip{position:absolute;left:-999px}
.skip:focus{left:1rem;top:1rem;background:var(--surface-solid);padding:.5rem .8rem;border-radius:8px;z-index:99}

/* nav */
.nav{position:sticky;top:0;z-index:40;backdrop-filter:blur(14px);
  background:color-mix(in srgb, var(--bg) 78%, transparent);border-bottom:1px solid var(--border)}
.nav-in{max-width:var(--maxw);margin:0 auto;padding:.6rem 1.25rem;display:flex;gap:1rem;align-items:center;justify-content:space-between;flex-wrap:wrap}
.nav-name{font-family:var(--font-display);font-weight:700;letter-spacing:-.01em;font-size:.98rem;color:var(--text)}
.nav-name span{color:var(--accent)}
.nav nav{display:flex;gap:.35rem;flex-wrap:wrap;align-items:center}
.nav a{font-size:.78rem;font-family:var(--font-mono);color:var(--muted);padding:.28rem .6rem;
  border:1px solid transparent;text-decoration:none;transition:.16s}
.nav a:hover{color:var(--text);text-decoration:none;border-color:var(--border)}
.nav-toggle{background:none;border:1px solid var(--border);color:var(--muted);border-radius:999px;
  width:30px;height:30px;cursor:pointer;font-size:.85rem;line-height:1}
.nav-toggle:hover{color:var(--text)}

/* hero */
main{padding:calc(var(--gap) * 1.4) 0 calc(var(--gap) * 2)}
.hero-card{display:grid;grid-template-columns:1fr;gap:var(--gap);padding:calc(var(--pad) * 1.3);
  border:1px solid var(--border);margin-bottom:var(--gap);position:relative;overflow:hidden}
.hero-inner{display:flex;gap:calc(var(--gap) * 1.2);align-items:center;flex-wrap:wrap}
.avatar{width:96px;height:96px;object-fit:cover;border-radius:18px;border:1px solid var(--border);flex:0 0 auto}
.avatar-fallback{width:96px;height:96px;border-radius:18px;display:grid;place-items:center;flex:0 0 auto;
  background:linear-gradient(140deg,var(--accent),var(--accent2));color:#fff;font-family:var(--font-display);
  font-size:2rem;font-weight:700;letter-spacing:-.03em}
.hero-kicker{font-family:var(--font-mono);font-size:.78rem;color:var(--accent);letter-spacing:.12em;text-transform:uppercase;margin-bottom:.4rem}
.hero-title{font-size:clamp(2rem,4.6vw,3.1rem);letter-spacing:-.025em;margin:0}
.hero-role{color:var(--muted);font-size:1.02rem;margin:.3rem 0 0;font-family:var(--font-display)}
.hero-tagline{max-width:60ch;color:var(--muted);margin:.8rem 0 0;font-size:1.02rem}
.meta{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1.1rem}
.meta .btn{font-size:.8rem}
.hero-actions{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1rem}
.hero-about{margin-top:1.1rem;padding-top:1.1rem;border-top:1px solid var(--border);color:var(--muted);max-width:66ch}

/* buttons + chips */
.btn{display:inline-flex;align-items:center;gap:.38rem;padding:.42rem .8rem;border-radius:calc(var(--radius) / 2);
  border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:.84rem;
  font-family:var(--font-body);text-decoration:none;transition:.16s;white-space:nowrap}
.btn:hover{text-decoration:none;border-color:var(--accent);color:var(--accent);transform:translateY(-1px)}
.btn-primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn-primary:hover{color:#fff;filter:brightness(1.07)}
.chips{display:flex;flex-wrap:wrap;gap:.4rem}
.chips-sm .chip{font-size:.74rem;padding:.2rem .55rem}
.chip{display:inline-flex;align-items:center;padding:.28rem .62rem;border-radius:999px;font-size:.82rem;
  border:1px solid var(--border);background:var(--surface);color:var(--text);font-family:var(--font-body)}

/* sections */
.section{padding:calc(var(--gap) * .9) 0;scroll-margin-top:76px}
.section-title{font-size:1.45rem;letter-spacing:-.02em;margin-bottom:calc(var(--gap) * .85)}
.sec-num{font-family:var(--font-mono);font-size:.8em;color:var(--accent);opacity:.85;margin-right:.25em}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:calc(var(--gap) * .8)}
.card{border:1px solid var(--border);border-radius:var(--radius);padding:var(--pad);background:var(--surface);
  box-shadow:var(--shadow);transition:transform .18s ease, border-color .18s ease}
.card:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--accent) 45%,var(--border))}
.card-head{display:flex;justify-content:space-between;gap:.8rem;align-items:baseline;flex-wrap:wrap}
.card-title{font-size:1.05rem;letter-spacing:-.01em}
.card-sub{color:var(--accent);font-size:.84rem;font-family:var(--font-mono);margin-top:.2rem}
.card-date{color:var(--muted);font-size:.76rem;font-family:var(--font-mono);white-space:nowrap}
.card-body{color:var(--muted);font-size:.93rem}
.card-body p{margin:.55rem 0 0}
.card-links{display:flex;gap:.45rem;flex-wrap:wrap;margin-top:.9rem}
.skill-groups{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:calc(var(--gap) * .8);margin-top:calc(var(--gap) * .7)}
.skill-label{font-family:var(--font-mono);font-size:.74rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:.45rem}
.prose{color:var(--muted);max-width:70ch}
.prose p{margin:0 0 .8rem}
.prose strong{color:var(--text)}
.prose h1,.prose h2,.prose h3,.prose h4{color:var(--text);margin:1.1rem 0 .4rem}
.prose ul,.prose ol{margin:.4rem 0 .8rem;padding-left:1.15rem}
.prose li{margin:.22rem 0}
.prose li::marker{color:var(--accent)}
.prose code{font-family:var(--font-mono);font-size:.86em;background:color-mix(in srgb,var(--text) 8%,transparent);
  padding:.12em .38em;border-radius:4px;color:var(--text)}
.prose pre{background:color-mix(in srgb,var(--text) 6%,transparent);padding:.9rem;border-radius:8px;overflow:auto;border:1px solid var(--border)}
.prose pre code{background:none;padding:0}
.prose blockquote{margin:1rem 0;padding:.2rem 0 .2rem 1rem;border-left:2px solid var(--accent);color:var(--text);font-style:italic}
.prose table{width:100%;border-collapse:collapse;font-size:.9rem}
.prose th,.prose td{border:1px solid var(--border);padding:.45rem .6rem;text-align:left}
.prose img{border-radius:8px;margin:.6rem 0}
.prose hr{border:none;border-top:1px solid var(--border);margin:1.4rem 0}
.prose a{border-bottom:1px solid color-mix(in srgb,var(--accent) 40%,transparent)}
.prose>:first-child{margin-top:0}

/* timeline */
.timeline{list-style:none;margin:0;padding:0 0 0 1.15rem;border-left:1px solid var(--border);display:grid;gap:calc(var(--gap) * .85)}
.tl-item{position:relative}
.dot{position:absolute;left:calc(-1.15rem - 4.5px);top:.55rem;width:8px;height:8px;border-radius:50%;
  background:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 18%,transparent)}
.tl-top{display:flex;gap:.8rem;justify-content:space-between;align-items:baseline;flex-wrap:wrap}
.tl-role{font-size:1.02rem}
.tl-org{color:var(--accent);font-size:.86rem;font-family:var(--font-mono);margin-top:.15rem}
.tl-date{color:var(--muted);font-size:.76rem;font-family:var(--font-mono);white-space:nowrap}
.tl-main .prose{font-size:.93rem;margin-top:.45rem}
.tl-main .prose p{margin:0 0 .4rem}

/* footer */
.foot{border-top:1px solid var(--border);margin-top:calc(var(--gap) * 1.5);padding:calc(var(--gap)) 0}
.foot-in{max-width:var(--maxw);margin:0 auto;padding:0 1.25rem;display:flex;justify-content:space-between;
  gap:1rem;flex-wrap:wrap;color:var(--muted);font-size:.8rem;font-family:var(--font-mono)}
.foot a{color:var(--muted)}
.foot a:hover{color:var(--accent)}

@media (max-width:640px){
  .hero-inner{gap:1rem}
  .avatar,.avatar-fallback{width:72px;height:72px;font-size:1.5rem}
  .section-title{font-size:1.28rem}
}
@media print{
  .nav,.hero-actions,.foot{display:none}
  body{background:#fff;color:#000}
  .card{box-shadow:none;break-inside:avoid}
}
${theme.skin || ''}`;
}

/* ------------------------------------------------------------------ */
/* body + document                                                     */
/* ------------------------------------------------------------------ */

const KIND_LABEL = {
  about: 'About',
  skills: 'Skills',
  projects: 'Projects',
  experience: 'Experience',
  education: 'Education',
  contact: 'Contact',
};

export function sectionVisible(s, options = {}) {
  const state = options.sections?.[s.id];
  if (state && state.hidden) return false;
  return !(state === undefined && s.hidden);
}

export function renderBody(data, options) {
  const { profile, sections = [] } = data;
  const opts = options || {};
  const visible = sections.filter((s) => sectionVisible(s, opts));
  const name = opts.name || profile.name || 'Your Name';
  const role = opts.role || profile.role || '';
  const tagline = opts.tagline || profile.tagline || '';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const introSec = visible.find((s) => s.kind === 'about' && s.id === 'intro');
  const rest = visible.filter((s) => s !== introSec);

  const contactSec = visible.find((s) => s.kind === 'contact');
  const contactLinks = [];
  if (profile.email) contactLinks.push({ label: 'Email', url: `mailto:${profile.email}` });
  if (profile.github) contactLinks.push({ label: 'GitHub', url: profile.github });
  if (profile.linkedin) contactLinks.push({ label: 'LinkedIn', url: profile.linkedin });
  if (profile.website) contactLinks.push({ label: 'Website', url: profile.website });
  if (profile.resume) contactLinks.push({ label: 'Résumé', url: profile.resume });

  const navItems = rest
    .filter((s) => s.kind !== 'contact')
    .map((s) => `<a href="#${attr(s.id)}">${esc(s.title)}</a>`)
    .join('');

  const hero = `<header class="hero-card">
  <div class="hero-inner">
    ${
      opts.showAvatar === false
        ? ''
        : profile.avatar
        ? `<img class="avatar" src="${attr(profile.avatar)}" alt="${attr(name)}" loading="lazy" />`
        : `<div class="avatar-fallback" aria-hidden="true">${esc(initials)}</div>`
    }
    <div class="hero-copy">
      ${opts.showLocation !== false && profile.location ? `<div class="hero-kicker">${esc(profile.location)}</div>` : `<div class="hero-kicker">Portfolio</div>`}
      <h1 class="hero-title">${esc(name)}</h1>
      ${role ? `<p class="hero-role">${esc(role)}</p>` : ''}
      ${tagline ? `<p class="hero-tagline">${esc(tagline)}</p>` : ''}
      ${opts.showMeta === false ? '' : `<div class="meta">${contactLinks.map((l) => btn(l.label, l.url)).join('')}</div>`}
    </div>
  </div>
  ${introSec && opts.showIntro !== false ? `<div class="prose hero-about">${mdToHtml(introSec.md)}</div>` : ''}
</header>`;

  const aboutHtml = '';

  const sectionHtml = rest
    .map((s, i) => {
      let inner;
      if (s.kind === 'skills') inner = renderSkills(s);
      else if (s.kind === 'projects') inner = renderCards(s);
      else if (s.kind === 'experience') inner = renderTimeline(s);
      else if (s.kind === 'education') inner = renderCards(s);
      else inner = `<div class="prose">${mdToHtml(s.md)}</div>`;
      return `<section class="section" id="${attr(s.id)}"><h2 class="section-title">${
        opts.numberHeadings ? `<span class="sec-num">${String(i + 1).padStart(2, '0')}</span> ` : ''
      }${esc(s.title)}</h2>${inner}</section>`;
    })
    .join('\n');

  const contactHtml = '';

  const nav =
    opts.showNav === false
      ? ''
      : `<div class="nav"><div class="nav-in">
    <a class="nav-name" href="#top">${esc(name.split(' ')[0])}<span>.</span></a>
    <nav>${navItems}</nav>
  </div></div>`;

  const footer = `<footer class="foot"><div class="foot-in">
  <span>© ${new Date().getFullYear()} ${esc(name)}</span>
  <span>Built with <a href="https://github.com" target="_blank" rel="noopener noreferrer">Portfolio Forge</a> · <a href="#top">Back to top ↑</a></span>
</div></footer>`;

  return { nav, hero, aboutHtml, sectionHtml, contactHtml, footer, name, role };
}

export function renderDocument(data, options = {}) {
  const theme = getTheme(options.themeId);
  const mode = options.mode === 'dark' ? 'dark' : 'light';
  const { nav, hero, aboutHtml, sectionHtml, contactHtml, footer, name, role } = renderBody(data, options);
  const css = buildCss({ theme, mode, options });
  const desc = (options.tagline || data.profile.tagline || `${name} — ${role}`).replace(/"/g, "'");

  return `<!doctype html>
<html lang="en" data-theme="${theme.id}" data-mode="${mode}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(name)}${role ? ` — ${esc(role)}` : ''}</title>
<meta name="description" content="${esc(desc)}" />
<meta property="og:title" content="${esc(name)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:type" content="profile" />
${data.profile.avatar ? `<meta property="og:image" content="${attr(data.profile.avatar)}" />` : ''}
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${
      (theme[mode] || theme.light).accent
    }"/><text x="16" y="22" font-family="system-ui" font-size="16" font-weight="700" fill="white" text-anchor="middle">${(name[0] || 'P').toUpperCase()}</text></svg>`
  )}" />
<style>${options.fontCss ? `${options.fontCss}\n` : ''}${css}</style>
</head>
<body id="top">
<a class="skip" href="#main">Skip to content</a>
${nav}
<main class="wrap" id="main">
${hero}
${aboutHtml}
${sectionHtml}
${contactHtml}
</main>
${footer}
<script>
  // progressive enhancement: keep the deployed page dependency-free
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var el = document.querySelector(a.getAttribute('href'));
      if(el){ e.preventDefault(); el.scrollIntoView({behavior:'smooth', block:'start'}); }
    });
  });
</script>
</body>
</html>`;
}

export { KIND_LABEL, paras };
