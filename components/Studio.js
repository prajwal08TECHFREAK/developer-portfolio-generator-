'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { THEMES } from '../lib/themes';
import { DEFAULT_OPTIONS } from '../lib/options';
import { mdToHtml } from '../lib/markdown-client';
import { parseFrontMatter, splitSections, classify, compilePortfolio } from '../lib/markdown.js';
import { renderDocument } from '../lib/render.js';
import { loadStudioFonts } from '../lib/fonts.js';
import { FONT_FILES } from '../lib/themes.js';
import { publishToGitHub, checkToken } from '../lib/github.js';
import { exportFiles } from '../lib/publish-files';
import { SAMPLE_MD } from '../lib/sample';

const LS_KEY = 'portfolio-forge:v1';

const KIND_ICON = {
  about: '◐',
  skills: '◇',
  projects: '▤',
  experience: '◷',
  education: '✎',
  contact: '✉',
  generic: '▪',
};

const KIND_COLOR = {
  about: 'text-sky-300',
  skills: 'text-teal-300',
  projects: 'text-violet-300',
  experience: 'text-amber-300',
  education: 'text-emerald-300',
  contact: 'text-rose-300',
  generic: 'text-slate-400',
};

/** Compile options: section order/hidden/renamed headings travel with the options. */
function compile(markdown, options, sections) {
  const overrides = options.sections || {};
  return compilePortfolio(markdown, {
    sectionOrder: sections ? sections.map((s) => s.id) : options.sectionOrder,
    hidden: Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, !!(v && v.hidden)])),
    titles: Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, (v && v.title) || ''])),
  });
}

/** The publishable HTML document (used for the preview frame, export and publish). */
function buildHtml(markdown, options, sections) {
  return renderDocument(compile(markdown, options, sections), options);
}

function buildFiles(markdown, options, sections) {
  return exportFiles({ html: buildHtml(markdown, options, sections), markdown, options });
}

/* ------------------------------------------------------------------ */
/* mini rendered blocks for the inline preview                         */
/* ------------------------------------------------------------------ */

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function listItems(html) {
  const out = [];
  const re = /<li>([\s\S]*?)<\/li>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function MiniSection({ section }) {
  const { kind, md } = section;
  const html = useMemo(() => mdToHtml(md), [md]);

  if (kind === 'skills') {
    const items = listItems(html).map((h) => h.replace(/<[^>]+>/g, '').trim());
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.length ? (
          items.map((s, i) => (
            <span key={i} className="rounded-full border border-line bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-300">
              {s}
            </span>
          ))
        ) : (
          <p className="text-[11px] text-slate-500">No list items found — use `- item` lines.</p>
        )}
      </div>
    );
  }

  if (kind === 'projects' || kind === 'education' || kind === 'experience') {
    const chunks = md.split(/\n(?=###\s)/).filter((c) => c.trim());
    const hasH3 = /^###\s/m.test(md);
    const cards = hasH3 ? chunks : [md];
    return (
      <div className="grid gap-1.5">
        {cards.slice(0, 6).map((c, i) => {
          const lines = c.split('\n');
          const title = (lines[0] || '').replace(/^###\s*/, '');
          const rest = lines.slice(1).join('\n');
          return (
            <div key={i} className="rounded-lg border border-line bg-white/[0.02] px-2.5 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[12px] font-semibold text-slate-100">{title || 'Entry'}</span>
                <span className="shrink-0 font-mono text-[10px] text-slate-500">{kind}</span>
              </div>
              <div
                className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-slate-400 [&_a]:text-brand [&_code]:text-slate-300 [&_p]:m-0"
                dangerouslySetInnerHTML={{ __html: mdToHtml(rest) }}
              />
            </div>
          );
        })}
        {cards.length > 6 && <p className="text-[10px] text-slate-500">+{cards.length - 6} more…</p>}
      </div>
    );
  }

  return (
    <div
      className="prose-mini text-[11.5px] leading-relaxed text-slate-400 [&_a]:text-brand [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-slate-200 [&_li]:ml-3 [&_li]:list-disc [&_p]:m-0 [&_p]:mb-1 [&_strong]:text-slate-100 [&_blockquote]:border-l-2 [&_blockquote]:border-brand/60 [&_blockquote]:pl-2 [&_blockquote]:italic"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Studio                                                              */
/* ------------------------------------------------------------------ */

export default function Studio({ initialSections = [] }) {
  const [markdown, setMarkdown] = useState(SAMPLE_MD);
  const [options, setOptions] = useState({ ...DEFAULT_OPTIONS });
  const [tab, setTab] = useState('content');
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const [device, setDevice] = useState('desktop');
  const [rightTab, setRightTab] = useState('preview');
  const [deploy, setDeploy] = useState(null); // result panel
  const [sections, setSections] = useState(initialSections);
  const [profile, setProfile] = useState(null);
  const [parseError, setParseError] = useState(null);
  const fileRef = useRef(null);
  const iframeRef = useRef(null);

  /* ---------- boot screen progress (see app/layout.js) ---------- */
  const boot = useRef({ started: Date.now(), last: 8 });
  const bootStep = useCallback((pct, label) => {
    const api = typeof window !== 'undefined' ? window.__pfBoot : null;
    if (!api) return;
    boot.current.last = Math.max(boot.current.last, pct);
    api.progress(boot.current.last, label);
  }, []);

  /* ---------- fonts (self-hosted, inlined on export) ---------- */
  const [fontCss, setFontCss] = useState('');
  useEffect(() => {
    bootStep(50, 'Loading theme fonts…');
    loadStudioFonts();
    const inlined = typeof document !== 'undefined' ? document.getElementById('pf-fonts-inline') : null;
    if (inlined) {
      // single-file build: the fonts are already embedded in the page
      setFontCss(inlined.textContent || '');
      bootStep(84, 'Reading your résumé…');
      return () => {};
    }
    let alive = true;
    (async () => {
      try {
        const prefix = process.env.NEXT_PUBLIC_ASSET_PREFIX;
        const base = prefix !== undefined ? prefix : process.env.NEXT_PUBLIC_BASE_PATH || '';
        const faces = await Promise.all(
          Object.values(FONT_FILES).map(async (f) => {
            const res = await fetch(`${base}${f.file}`).catch(() => null);
            if (!res || !res.ok) return '';
            const buf = await res.arrayBuffer();
            let bin = '';
            const bytes = new Uint8Array(buf);
            for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
            return `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};font-display:swap;src:url(data:font/woff2;base64,${btoa(bin)}) format('woff2')}`;
          })
        );
        if (alive) setFontCss(faces.filter(Boolean).join('\n'));
        bootStep(70, 'Reading your résumé…');
      } catch {
        /* fonts are a nicety: exported sites fall back to system stacks */
      }
    })();
    return () => {
      alive = false;
    };
  }, [bootStep]);

  /* ---------- persistence ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.markdown === 'string') setMarkdown(parsed.markdown);
        if (parsed.options) setOptions({ ...DEFAULT_OPTIONS, ...parsed.options });
        if (parsed.deploy) setDeploy(parsed.deploy);
      }
    } catch {}
    bootStep(84, 'Restoring your draft…');
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootStep]);

  useEffect(() => {
    if (!hydrated) return;
    setSaved(false);
    const id = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ markdown, options, deploy }));
        setSaved(true);
      } catch {}
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown, options, hydrated]);

  /* ---------- layout: deep-link ?view=preview ---------- */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('view') === 'preview') setRightTab('preview');
  }, []);

  const flash = useCallback((msg, tone = 'ok') => {
    setToast({ msg, tone, id: Date.now() });
    setTimeout(() => setToast((t) => (t && Date.now() - t.id > 2400 ? null : t)), 2600);
  }, []);

  const set = (patch) => setOptions((o) => ({ ...o, ...patch }));
  const setSection = (id, patch) =>
    setOptions((o) => ({ ...o, sections: { ...o.sections, [id]: { ...(o.sections[id] || {}), ...patch } } }));

  /* ---------- debounced section analysis ---------- */
  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => {
      try {
        const { profile: fm, body } = parseFrontMatter(markdown);
        const { sections: secs } = splitSections(body);
        setProfile(fm);
        setParseError(null);

        setSections((prev) => {
          const prevById = Object.fromEntries(prev.map((s) => [s.id, s]));
          const found = secs.map((sec) => ({
            id: sec.key,
            title: sec.title,
            kind: classify(sec.key, sec.title),
            md: sec.md,
            words: sec.md.split(/\s+/).filter(Boolean).length,
            hidden: prevById[sec.key] ? prevById[sec.key].hidden : false,
          }));
          const order = (options.sectionOrder || []).filter((id) => found.some((f) => f.id === id));
          const rest = found.filter((f) => !order.includes(f.id)).map((f) => f.id);
          return [...order, ...rest].map((id) => found.find((f) => f.id === id)).filter(Boolean);
        });
      } catch (err) {
        setParseError(String(err.message || err));
      }
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown, hydrated]);

  /* ---------- preview html (compiled in the browser) ---------- */
  const html = useMemo(() => {
    if (!hydrated) return '';
    bootStep(92, 'Rendering the preview…');
    try {
      return buildHtml(markdown, options, sections);
    } catch (err) {
      flash(String(err.message || err), 'err');
      return '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown, options, sections, hydrated]);

  const previewSrc = useMemo(() => html || '<!doctype html><body style="background:#0b0c12"></body>', [html]);

  // hand over from the boot screen as soon as the studio can be used
  useEffect(() => {
    if (!hydrated) return;
    const api = typeof window !== 'undefined' ? window.__pfBoot : null;
    if (!api) return;
    const finish = () => {
      bootStep(100, 'Ready');
      api.done();
    };
    if (html || document.readyState === 'complete') {
      const id = setTimeout(finish, html ? 120 : 400);
      return () => clearTimeout(id);
    }
    const id = setTimeout(finish, 1500); // never block on the preview
    return () => clearTimeout(id);
  }, [hydrated, html, bootStep]);

  /* ---------- actions ---------- */
  const injectDownload = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll('[data-pf-extra]').forEach((n) => n.remove());
  };
  useEffect(injectDownload, [previewSrc]);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  // `openUrl` is injected by the standalone (single-file) build, because a
  // relocatable file cannot link to the sibling /preview/ route.
  const openPreview = () => {
    if (typeof window !== 'undefined' && typeof window.__pfStandaloneOpen === 'function') {
      window.__pfStandaloneOpen(buildHtml(markdown, { ...options, fontCss }, sections));
      return;
    }
    sessionStorage.setItem('pf:html', html);
    window.open(`${basePath}/preview/`, '_blank');
  };

  const downloadHtml = () => {
    const blob = new Blob([buildHtml(markdown, { ...options, fontCss }, sections)], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'index.html';
    a.click();
    URL.revokeObjectURL(a.href);
    flash('index.html downloaded');
  };

  const downloadZip = async () => {
    setBusy(true);
    try {
      const files = buildFiles(markdown, { ...options, fontCss }, sections);
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      Object.entries(files).forEach(([path, content]) => zip.file(path, content));
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(profile?.name || 'portfolio').toLowerCase().replace(/\s+/g, '-')}-site.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      flash('Project zip downloaded');
    } catch (err) {
      flash(String(err.message || err), 'err');
    } finally {
      setBusy(false);
    }
  };

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(html);
      flash('HTML copied to clipboard');
    } catch {
      flash('Clipboard blocked by the browser', 'err');
    }
  };

  const importFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    if (!/\.(md|markdown|mdx|txt)$/i.test(file.name)) {
      flash('That is not a .md file — importing anyway', 'err');
    }
    setMarkdown(text);
    flash(`Imported ${file.name}`);
  };

  const moveSection = (id, dir) => {
    setSections((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      setOptions((o) => ({ ...o, sectionOrder: next.map((s) => s.id) }));
      return next;
    });
  };

  const resetAll = () => {
    if (!confirm('Reset the editor, theme and sections back to the sample portfolio?')) return;
    localStorage.removeItem(LS_KEY);
    setMarkdown(SAMPLE_MD);
    setOptions({ ...DEFAULT_OPTIONS });
    setDeploy(null);
    setPreviewKey((k) => k + 1);
    flash('Reset to sample');
  };

  const visibleCount = sections.filter((s) => !(options.sections[s.id]?.hidden ?? s.hidden)).length;

  /* ---------- render ---------- */
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* top bar */}
      <header className="z-30 flex shrink-0 items-center gap-3 border-b border-line bg-ink/80 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand2 text-[13px] font-black text-ink">
            ⌘
          </div>
          <div className="leading-tight">
            <div className="whitespace-nowrap text-[13px] font-semibold text-white">
              Portfolio Forge
              <span className="ml-1.5 rounded bg-white/10 px-1 py-0.5 align-middle font-mono text-[9px] font-normal text-slate-400">beta</span>
            </div>
            <div className="hidden text-[10px] text-slate-500 sm:block">Markdown → hosted developer portfolio</div>
          </div>
        </div>

        <div className="mx-2 hidden items-center gap-1 sm:flex">
          {['content', 'design', 'sections', 'publish'].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`tab capitalize ${tab === t ? 'tab-active' : ''}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span className={`hidden items-center gap-1 text-[10px] sm:flex ${saved ? 'text-emerald-400/80' : 'text-amber-400/80'}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {saved ? 'saved locally' : 'saving…'}
          </span>
          <button className="btn btn-ghost hidden sm:inline-flex" onClick={resetAll} title="Start over">
            Reset
          </button>
          <button className="btn hidden md:inline-flex" onClick={copyHtml}>
            Copy HTML
          </button>
          <button className="btn hidden md:inline-flex" onClick={downloadHtml} title="Single self-contained file">
            ↓ index.html
          </button>
          <button className="btn" onClick={downloadZip} disabled={busy}>
            {busy ? 'Zipping…' : '↓ Project .zip'}
          </button>
          <button className="btn btn-primary" onClick={() => setTab('publish')}>
            Publish to GitHub
          </button>
        </div>
      </header>

      {/* mobile tabs */}
      <div className="flex shrink-0 gap-1 border-b border-line px-2 py-1.5 sm:hidden">
        {['content', 'design', 'sections', 'publish'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab flex-1 capitalize ${tab === t ? 'tab-active' : ''}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ---------------- left rail ---------------- */}
        <aside className="flex w-full min-w-0 flex-col border-r border-line sm:w-[380px] lg:w-[420px]">
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === 'content' && (
              <ContentTab
                markdown={markdown}
                setMarkdown={setMarkdown}
                fileRef={fileRef}
                importFile={importFile}
                profile={profile}
                sections={sections}
                parseError={parseError}
                words={markdown.split(/\s+/).filter(Boolean).length}
                onSample={() => {
                  setMarkdown(SAMPLE_MD);
                  flash('Sample loaded');
                }}
                onClear={() => setMarkdown('---\nname: Your Name\nrole: Developer\n---\n\n## About\n\nTell your story here.\n')}
              />
            )}
            {tab === 'design' && <DesignTab options={options} set={set} />}
            {tab === 'sections' && (
              <SectionsTab
                sections={sections}
                options={options}
                set={set}
                setSection={setSection}
                move={moveSection}
                profile={profile}
              />
            )}
            {tab === 'publish' && (
              <PublishTab
                fontCss={fontCss}
                markdown={markdown}
                options={options}
                sections={sections}
                deploy={deploy}
                setDeploy={setDeploy}
                flash={flash}
                html={html}
              />
            )}
          </div>
          <div className="shrink-0 border-t border-line px-3 py-2 text-[10px] leading-relaxed text-slate-500">
            {sections.length} sections · {visibleCount} visible · theme <span className="text-slate-300">{THEMES.find((t) => t.id === options.themeId)?.name}</span>
          </div>
        </aside>

        {/* ---------------- right: preview ---------------- */}
        <section className="hidden min-w-0 flex-1 flex-col sm:flex">
          <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-1.5">
            <div className="seg">
              <button className={rightTab === 'preview' ? 'on' : ''} onClick={() => setRightTab('preview')}>
                Live preview
              </button>
              <button className={rightTab === 'outline' ? 'on' : ''} onClick={() => setRightTab('outline')}>
                Outline
              </button>
            </div>
            <div className="ml-1 flex items-center gap-1 rounded-lg border border-line p-0.5">
              {[
                ['mobile', '▢'],
                ['desktop', '▭'],
                ['full', '⛶'],
              ].map(([d, icon]) => (
                <button
                  key={d}
                  onClick={() => setDevice(d)}
                  title={d}
                  className={`rounded px-1.5 py-0.5 text-[11px] ${device === d ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  {icon}
                </button>
              ))}
            </div>
            <button className={`btn ml-auto ${options.mode === 'dark' ? '' : 'btn-ghost'}`} onClick={() => set({ mode: options.mode === 'dark' ? 'light' : 'dark' })}>
              {options.mode === 'dark' ? '☾ dark' : '☀ light'}
            </button>
            <button className="btn btn-ghost" onClick={() => setPreviewKey((k) => k + 1)} title="Re-render">
              ↻
            </button>
            <button className="btn" onClick={openPreview}>
              Open full screen ↗
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-[#070810] p-3">
            {rightTab === 'preview' ? (
              <div
                className={`mx-auto h-full overflow-hidden rounded-xl border border-line bg-white shadow-2xl transition-all ${
                  device === 'mobile' ? 'max-w-[390px]' : device === 'desktop' ? 'max-w-[1100px]' : 'max-w-none'
                }`}
              >
                <iframe
                  key={`${previewKey}-${device}`}
                  ref={iframeRef}
                  title="Portfolio preview"
                  srcDoc={previewSrc}
                  className="h-full w-full"
                  sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
                />
              </div>
            ) : (
              <Outline sections={sections} options={options} setSection={setSection} move={moveSection} profile={profile} />
            )}
          </div>
        </section>
      </div>

      {/* mobile preview drawer hint */}
      <button
        onClick={openPreview}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-brand px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand/30 sm:hidden"
      >
        Preview site ↗
      </button>

      {toast && (
        <div
          role="status"
          className={`pointer-events-none fixed bottom-5 left-1/2 z-[60] max-w-[min(90vw,420px)] -translate-x-1/2 animate-fadein rounded-lg border px-3 py-2 text-center text-[11px] leading-relaxed shadow-2xl backdrop-blur ${
            toast.tone === 'err' ? 'border-rose-500/40 bg-rose-950/90 text-rose-200' : 'border-line bg-panel text-slate-200'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* tabs                                                               */
/* ================================================================== */

function ContentTab({ markdown, setMarkdown, fileRef, importFile, profile, sections, parseError, words, onSample, onClear }) {
  const [drag, setDrag] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button className="btn" onClick={() => fileRef.current?.click()}>
          ⇪ Import .md
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".md,.markdown,.mdx,.txt"
          className="hidden"
          onChange={(e) => importFile(e.target.files?.[0])}
        />
        <button className="btn btn-ghost" onClick={onSample}>
          Sample
        </button>
        <button className="btn btn-ghost" onClick={onClear}>
          Blank
        </button>
        <label className="btn ml-auto cursor-pointer">
          <input
            type="file"
            accept=".md,.markdown,.mdx,.txt"
            className="hidden"
            onChange={(e) => importFile(e.target.files?.[0])}
          />
          Drop file
        </label>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          importFile(e.dataTransfer.files?.[0]);
        }}
        className={`relative rounded-xl border transition ${drag ? 'border-brand bg-brand/10' : 'border-line'}`}
      >
        <textarea
          spellCheck={false}
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              const el = e.currentTarget;
              const start = el.selectionStart;
              const next = `${markdown.slice(0, start)}  ${markdown.slice(el.selectionEnd)}`;
              setMarkdown(next);
              requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2));
            }
          }}
          className="code h-[calc(100vh-320px)] min-h-[280px] w-full resize-none rounded-xl bg-[#0b0d14] p-3 font-mono text-[11.5px] leading-[1.65] text-slate-300 outline-none placeholder:text-slate-600"
          placeholder={'---\nname: Your Name\nrole: Developer\n---\n\n## About\n\nI build things for the web.'}
        />
        {drag && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-ink/70 text-xs text-brand">
            Drop your .md file
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono">{words} words</span>
        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono">{sections.length} sections</span>
        {parseError ? (
          <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-300">front matter: {parseError}</span>
        ) : (
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300/90">
            {profile?.name ? `${profile.name} · ${profile.role || 'no role'}` : 'no front matter'}
          </span>
        )}
      </div>

      <details className="module">
        <summary className="cursor-pointer text-[11px] font-semibold text-slate-300">
          Markdown cheat sheet <span className="font-normal text-slate-500">(front matter · sections · entries)</span>
        </summary>
        <div className="mt-2 space-y-2 font-mono text-[10.5px] leading-relaxed text-slate-400">
          <pre className="overflow-x-auto rounded bg-black/40 p-2 text-teal-200/90">{`---
name: Aditi Sharma
role: Full-Stack Developer
tagline: I build fast web products.
location: Pune, India
email: you@example.com
github: https://github.com/you
linkedin: https://linkedin.com/in/you
website: https://you.dev
avatar: https://…/photo.jpg
---`}</pre>
          <p className="text-slate-500">
            <span className="text-slate-300">## Section</span> headings become site sections. Titles like{' '}
            <span className="text-slate-300">Skills, Projects, Experience, Education, About, Contact</span> pick specialised layouts —{' '}
            <span className="text-slate-300">### </span> entries become cards or timeline rows. Anything else renders as prose.
          </p>
          <pre className="overflow-x-auto rounded bg-black/40 p-2 text-teal-200/90">{`## Projects
### Orbit — release dashboard
Markdown description with **bold** and [links](https://x.dev).
- Tech: Next.js, Postgres
- [Live](https://…) · [Source](https://github.com/…)`}</pre>
        </div>
      </details>
    </div>
  );
}

function DesignTab({ options, set }) {
  const theme = THEMES.find((t) => t.id === options.themeId) || THEMES[0];
  const palette = theme[options.mode] || theme.light;
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label mb-0">Theme</span>
          <span className="text-[10px] text-slate-500">{theme.vibe}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => {
            const p = t[options.mode] || t.light;
            const on = t.id === options.themeId;
            return (
              <button
                key={t.id}
                onClick={() => set({ themeId: t.id })}
                className={`group relative overflow-hidden rounded-xl border p-2 text-left transition ${
                  on ? 'border-brand ring-2 ring-brand/30' : 'border-line hover:border-slate-600'
                }`}
              >
                <div className="mb-1.5 overflow-hidden rounded-md border" style={{ borderColor: p.border, background: p.bg }}>
                  <div className="flex items-center gap-1 px-1.5 py-1" style={{ borderBottom: `1px solid ${p.border}` }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.accent }} />
                    <span className="h-1 w-8 rounded-full" style={{ background: p.muted, opacity: 0.5 }} />
                  </div>
                  <div className="space-y-1 p-1.5">
                    <div className="h-2 w-3/4 rounded-sm" style={{ background: p.text, opacity: 0.85 }} />
                    <div className="h-1 w-full rounded-sm" style={{ background: p.muted, opacity: 0.45 }} />
                    <div className="flex gap-1">
                      <span className="h-2.5 w-6 rounded-full" style={{ background: p.accent, opacity: 0.85 }} />
                      <span className="h-2.5 w-5 rounded-full" style={{ background: p.accent2, opacity: 0.7 }} />
                    </div>
                    <div className="rounded p-1" style={{ background: p.surface, border: `1px solid ${p.border}` }}>
                      <div className="h-1 w-2/3 rounded-sm" style={{ background: p.muted, opacity: 0.4 }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-200">{t.name}</span>
                  {on && <span className="text-[9px] text-brand">active</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="label">Mode</span>
          <div className="seg">
            <button className={options.mode === 'light' ? 'on' : ''} onClick={() => set({ mode: 'light' })}>
              ☀ Light
            </button>
            <button className={options.mode === 'dark' ? 'on' : ''} onClick={() => set({ mode: 'dark' })}>
              ☾ Dark
            </button>
          </div>
        </div>
        <div>
          <span className="label">Density</span>
          <div className="seg">
            {['compact', 'cozy', 'airy'].map((d) => (
              <button key={d} className={options.density === d ? 'on' : ''} onClick={() => set({ density: d })}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Corners</span>
          <div className="seg">
            {['sharp', 'default', 'round'].map((r) => (
              <button key={r} className={options.radius === r ? 'on' : ''} onClick={() => set({ radius: r })}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Width</span>
          <div className="seg">
            {['narrow', 'regular', 'wide'].map((w) => (
              <button key={w} className={options.width === w ? 'on' : ''} onClick={() => set({ width: w })}>
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="label">Display font</span>
          <select className="input" value={options.fontDisplay} onChange={(e) => set({ fontDisplay: e.target.value })}>
            <option value="sans">Sans (Inter/system)</option>
            <option value="serif">Serif</option>
            <option value="mono">Mono</option>
          </select>
        </div>
        <div>
          <span className="label">Body font</span>
          <select className="input" value={options.fontBody} onChange={(e) => set({ fontBody: e.target.value })}>
            <option value="sans">Sans</option>
            <option value="serif">Serif</option>
            <option value="mono">Mono</option>
          </select>
        </div>
      </div>

      <div>
        <span className="label">Accent colours (override theme)</span>
        <div className="flex items-center gap-2">
          <label className="flex flex-1 items-center gap-1.5 rounded-lg border border-line bg-black/30 px-2 py-1">
            <input type="color" value={options.accent || palette.accent} onChange={(e) => set({ accent: e.target.value })} className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
            <span className="font-mono text-[10px] text-slate-400">{(options.accent || palette.accent).slice(0, 7)}</span>
          </label>
          <label className="flex flex-1 items-center gap-1.5 rounded-lg border border-line bg-black/30 px-2 py-1">
            <input type="color" value={options.accent2 || palette.accent2} onChange={(e) => set({ accent2: e.target.value })} className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
            <span className="font-mono text-[10px] text-slate-400">{(options.accent2 || palette.accent2).slice(0, 7)}</span>
          </label>
          <button className="btn btn-ghost" onClick={() => set({ accent: '', accent2: '' })} title="Use theme colours">
            reset
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="label">Page elements</span>
        {[
          ['showNav', 'Sticky navigation bar'],
          ['showAvatar', 'Profile photo / initials'],
          ['showMeta', 'Contact buttons in hero'],
          ['showIntro', 'Intro text in hero'],
          ['showLocation', 'Location kicker'],
          ['numberHeadings', 'Numbered section headings'],
        ].map(([key, label]) => (
          <Toggle key={key} on={options[key] !== false} label={label} onClick={() => set({ [key]: options[key] === false })} />
        ))}
      </div>
    </div>
  );
}

function Toggle({ on, label, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left transition hover:bg-white/5">
      <span className="text-[11.5px] text-slate-300">{label}</span>
      <span className={`relative h-4 w-7 rounded-full transition ${on ? 'bg-brand' : 'bg-slate-700'}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function Row({ section, options, setSection, move, index, count }) {
  const hidden = options.sections[section.id]?.hidden ?? section.hidden;
  return (
    <div className={`group flex items-center gap-2 rounded-xl border border-line bg-black/20 px-2 py-1.5 transition ${hidden ? 'opacity-45' : ''}`}>
      <span className={`w-3 text-center text-[11px] ${KIND_COLOR[section.kind]}`}>{KIND_ICON[section.kind]}</span>
      <input
        value={options.sections[section.id]?.title ?? section.title}
        onChange={(e) => setSection(section.id, { title: e.target.value })}
        className="min-w-0 flex-1 truncate bg-transparent text-[12px] font-medium text-slate-200 outline-none focus:text-white"
        aria-label={`Rename ${section.title}`}
      />
      <span className="hidden shrink-0 rounded bg-white/5 px-1 font-mono text-[9px] text-slate-500 sm:block">{section.kind}</span>
      <div className="flex shrink-0 items-center">
        <button className="px-1 text-[11px] text-slate-600 hover:text-white disabled:opacity-30" onClick={() => move(section.id, -1)} disabled={index === 0} title="Move up">
          ↑
        </button>
        <button className="px-1 text-[11px] text-slate-600 hover:text-white disabled:opacity-30" onClick={() => move(section.id, 1)} disabled={index === count - 1} title="Move down">
          ↓
        </button>
        <button
          className={`px-1 text-[11px] ${hidden ? 'text-slate-600 hover:text-white' : 'text-brand hover:text-white'}`}
          onClick={() => setSection(section.id, { hidden: !hidden })}
          title={hidden ? 'Show section' : 'Hide section'}
        >
          {hidden ? '◌' : '◉'}
        </button>
      </div>
    </div>
  );
}

function SectionsTab({ sections, options, set, setSection, move, profile }) {
  const [open, setOpen] = useState(sections[0]?.id || null);
  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-slate-500">
        Sections are discovered from <span className="font-mono text-slate-300">##</span> headings. Rename, reorder or hide them — the Markdown
        source stays untouched. The type badge controls which layout the section gets.
      </p>

      <div className="space-y-1.5">
        {sections.map((s, i) => (
          <div key={s.id}>
            <Row section={s} options={options} setSection={setSection} move={move} index={i} count={sections.length} />
            <button className="mt-0.5 px-3 text-[10px] text-slate-500 hover:text-brand" onClick={() => setOpen(open === s.id ? null : s.id)}>
              {open === s.id ? '▾ hide markdown' : '▸ view markdown'}
            </button>
            {open === s.id && (
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-black/40 p-2 font-mono text-[10px] text-slate-400">
                {s.md || '(no content)'}
              </pre>
            )}
          </div>
        ))}
      </div>

      {profile && (
        <div className="module">
          <div className="mb-1.5 text-[11px] font-semibold text-slate-300">Hero content</div>
          <div className="space-y-1.5">
            {[
              ['name', 'Name', profile.name],
              ['role', 'Role', profile.role],
              ['tagline', 'Tagline', profile.tagline],
            ].map(([key, label, value]) => (
              <div key={key}>
                <span className="label">{label}</span>
                <input
                  className="input"
                  value={options[key] ?? ''}
                  placeholder={value || `from front matter`}
                  onChange={(e) => set({ [key]: e.target.value })}
                />
              </div>
            ))}
            <p className="text-[10px] text-slate-500">Empty = use front matter value.</p>
          </div>
        </div>
      )}
      <p className="text-[10px] text-slate-600">Hero overrides are applied live and never written back to your Markdown.</p>
    </div>
  );
}

function PublishTab({ markdown, options, sections, deploy, setDeploy, flash, html, fontCss }) {
  const [token, setToken] = useState('');
  const [repo, setRepo] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [steps, setSteps] = useState([]);
  const [copied, setCopied] = useState('');
  const [tokenInfo, setTokenInfo] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('pf:deploy-config');
    if (saved) {
      try {
        const c = JSON.parse(saved);
        setRepo(c.repo || '');
        setRemember(!!c.repo);
      } catch {}
    }
    const tk = sessionStorage.getItem('pf:token');
    if (tk) setToken(tk);
  }, []);

  const run = async () => {
    setError('');
    setSteps([]);
    setDeploy(null);
    if (!token.trim()) return setError('Paste a GitHub token — classic with `repo` scope, or fine-grained with Contents: Read & write.');
    setBusy(true);
    if (remember) localStorage.setItem('pf:deploy-config', JSON.stringify({ repo }));
    if (document.getElementById('pf-remember-token')?.checked) sessionStorage.setItem('pf:token', token);
    const live = [];
    try {
      const publishHtml = buildHtml(markdown, { ...options, fontCss }, sections);
      const files = exportFiles({ html: publishHtml, markdown, options }); // index.html + source + Pages workflow
      const result = await publishToGitHub({
        token: token.trim(),
        repo: (repo.trim() || suggestedRepo(options, sections, markdown)),
        private: isPrivate,
        description: `${options.name || 'Developer'} portfolio`,
        html: publishHtml,
        files,
        onStep: (step) => {
          live.push(step);
          setSteps([...live]);
        },
      });
      setDeploy(result);
      flash('Published to GitHub 🚀');
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setBusy(false);
    }
  };

  const testToken = async () => {
    setError('');
    try {
      const who = await checkToken(token.trim());
      setTokenInfo(who);
      flash(`Token works — @${who.login}`);
    } catch (err) {
      setTokenInfo(null);
      setError(String(err.message || err));
    }
  };

  const copy = async (text, tag) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(''), 1500);
    } catch {}
  };

  const workflow = `name: Deploy portfolio
on: { push: { branches: [main] } }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: . }
      - uses: actions/deploy-pages@v4`;

  return (
    <div className="space-y-3">
      <div className="module border-brand/30 bg-brand/[0.06]">
        <div className="text-[11.5px] font-semibold text-white">Publish to GitHub Pages</div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
          Creates (or updates) the repo, commits a self-contained <span className="font-mono text-slate-200">index.html</span>, your{' '}
          <span className="font-mono text-slate-200">portfolio.md</span> source, a Pages workflow and enables Pages — all in one request.
        </p>
      </div>

      <div>
        <span className="label">Personal access token</span>
        <input
          className="input font-mono"
          type="password"
          placeholder="ghp_… or github_pat_…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
        />
        <div className="mt-1 flex items-center justify-between gap-2">
          <a
            className="text-[10px] text-brand hover:underline"
            href="https://github.com/settings/tokens/new?scopes=repo&description=Portfolio%20Forge"
            target="_blank"
            rel="noopener noreferrer"
          >
            Create a classic token with `repo` scope ↗
          </a>
          <button className="btn btn-ghost" onClick={testToken} disabled={!token.trim()}>
            Test token
          </button>
        </div>
        {tokenInfo && (
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-300">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500/20 text-[8px]">✓</span>
            signed in as <span className="font-mono">@{tokenInfo.login}</span>
          </div>
        )}
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Stored only in this tab if you tick the box below.</span>
          <label className="flex items-center gap-1 text-[10px] text-slate-500">
            <input type="checkbox" id="pf-remember-token" className="accent-brand" /> keep for this tab
          </label>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
          This app is fully static — the token goes straight from your browser to <span className="font-mono">api.github.com</span>, never to any
          server of ours, and is never stored. Use a fine-grained token limited to the target repo and revoke it when you&apos;re done.
        </p>
      </div>

      <div>
        <span className="label">Repository name</span>
        <div className="flex items-center gap-1">
          <span className="shrink-0 rounded-l-lg border border-r-0 border-line bg-black/40 px-2 py-1.5 font-mono text-[11px] text-slate-500">github.com/you/</span>
          <input className="input rounded-l-none font-mono" placeholder={suggestedRepo(options, sections, markdown)} value={repo} onChange={(e) => setRepo(e.target.value)} />
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          Name it <span className="font-mono text-slate-300">&lt;username&gt;.github.io</span> for a root-domain site, anything else for{' '}
          <span className="font-mono text-slate-300">/repo</span>.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Toggle on={isPrivate} label="Private repository" onClick={() => setIsPrivate((v) => !v)} />
        <Toggle on={remember} label="Remember repo name" onClick={() => setRemember((v) => !v)} />
      </div>

      <button className="btn btn-primary w-full py-2" onClick={run} disabled={busy}>
        {busy ? 'Publishing…' : deploy ? 'Publish again' : 'Deploy to GitHub Pages'}
      </button>

      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-2 text-[11px] leading-relaxed text-rose-200">{error}</div>}

      {steps.length > 0 && (
        <ol className="space-y-1">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px]">
              <span className={s.ok ? 'text-emerald-400' : 'text-amber-400'}>{s.ok ? '✓' : '!'}</span>
              <span className="text-slate-300">
                {s.name} {s.detail && <span className="font-mono text-[10px] text-slate-500">{s.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      {deploy?.ok && (
        <div className="animate-fadein space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-2.5">
          <div className="text-[11.5px] font-semibold text-emerald-200">
            {deploy.createdRepo ? 'Repository created' : 'Repository updated'} · {deploy.fullName}
          </div>
          {deploy.pagesUrl ? (
            <a href={deploy.pagesUrl} target="_blank" rel="noopener noreferrer" className="block break-all rounded-lg bg-black/40 p-2 font-mono text-[11px] text-emerald-300 hover:underline">
              {deploy.pagesUrl} ↗
            </a>
          ) : (
            <p className="text-[11px] text-amber-200/90">{deploy.pagesNote}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <a className="btn" href={deploy.repoUrl} target="_blank" rel="noopener noreferrer">
              Repo ↗
            </a>
            <a className="btn" href={deploy.commitUrl} target="_blank" rel="noopener noreferrer">
              Commit ↗
            </a>
            {deploy.pagesUrl && (
              <button className="btn" onClick={() => copy(deploy.pagesUrl, 'pages')}>
                {copied === 'pages' ? 'Copied' : 'Copy URL'}
              </button>
            )}
          </div>
          <p className="text-[10px] leading-relaxed text-slate-400">
            First publish can take 1–2 minutes. To update later, edit your Markdown here and hit Publish again — the same commit flow
            overwrites <span className="font-mono">index.html</span>.
          </p>
        </div>
      )}

      <details className="module">
        <summary className="cursor-pointer text-[11px] font-semibold text-slate-300">What gets pushed?</summary>
        <ul className="mt-1.5 space-y-0.5 font-mono text-[10px] text-slate-400">
          <li>index.html — the whole site, no build step</li>
          <li>portfolio.md — your source</li>
          <li>README.md · .gitignore · .nojekyll</li>
          <li>.github/workflows/deploy.yml — optional Actions deploy</li>
        </ul>
        <button className="btn mt-2 w-full" onClick={() => copy(workflow, 'wf')}>
          {copied === 'wf' ? 'Copied workflow' : 'Copy Pages workflow YAML'}
        </button>
      </details>

      <details className="module">
        <summary className="cursor-pointer text-[11px] font-semibold text-slate-300">How the publish works (no backend)</summary>
        <p className="mt-1 text-[10.5px] leading-relaxed text-slate-400">
          The Git flow (<span className="font-mono text-slate-200">lib/github.js</span>) runs entirely in your browser against the GitHub REST API:
          ensure repo → upload blobs → build tree → commit → update <span className="font-mono text-slate-200">refs/heads/main</span> → enable Pages.
          Re-publishing adds one fast-forward commit; nothing is ever force-pushed.
        </p>
      </details>
    </div>
  );
}

function suggestedRepo(options, sections, markdown) {
  const name = (options.name || parseFrontMatter(markdown).profile.name || 'portfolio').toLowerCase();
  return `${name.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'portfolio'}-portfolio`;
}

function Outline({ sections, options, setSection, move, profile }) {
  return (
    <div className="mx-auto max-w-2xl space-y-2">
      <div className="rounded-xl border border-line bg-panel/60 p-3">
        <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Outline / section control</div>
        <div className="mt-0.5 text-[15px] font-semibold text-white">{options.name || profile?.name || 'Your Name'}</div>
        <div className="text-[11px] text-slate-400">{options.role || profile?.role || 'Developer'}</div>
      </div>
      {sections.map((s, i) => (
        <div key={s.id} className="rounded-xl border border-line bg-panel/40 p-2.5">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] ${KIND_COLOR[s.kind]}`}>{KIND_ICON[s.kind]}</span>
            <span className="text-[12px] font-semibold text-slate-100">{options.sections[s.id]?.title ?? s.title}</span>
            <span className="rounded bg-white/5 px-1 font-mono text-[9px] text-slate-500">{s.kind}</span>
            <span className="ml-auto font-mono text-[9px] text-slate-600">{s.words ?? 0}w</span>
            <button className="px-1 text-[11px] text-slate-600 hover:text-white" onClick={() => move(s.id, -1)} disabled={i === 0}>
              ↑
            </button>
            <button className="px-1 text-[11px] text-slate-600 hover:text-white" onClick={() => move(s.id, 1)} disabled={i === sections.length - 1}>
              ↓
            </button>
            <button
              className="px-1 text-[11px] text-brand hover:text-white"
              onClick={() => setSection(s.id, { hidden: !(options.sections[s.id]?.hidden ?? s.hidden) })}
            >
              {(options.sections[s.id]?.hidden ?? s.hidden) ? '◌' : '◉'}
            </button>
          </div>
          <div className="mt-2">
            <MiniSection section={s} />
          </div>
        </div>
      ))}
    </div>
  );
}
