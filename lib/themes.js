// Theme definitions. Each theme is a palette (light + dark) plus a structural
// "skin" (a small CSS block that can restyle the shared layout).
// Everything is plain CSS so the exported index.html is fully self-contained.

// Self-hosted variable fonts (loaded by the studio, inlined as data URIs in
// exported sites) so no viewer ever needs a network request to render a theme.
export const FONT_FILES = {
  inter: { family: 'Inter', file: '/fonts/inter-latin-var.woff2', weight: '100 900' },
  jetbrains: { family: 'JetBrains Mono', file: '/fonts/jetbrains-mono-latin-var.woff2', weight: '100 800' },
  newsreader: { family: 'Newsreader', file: '/fonts/newsreader-latin-var.woff2', weight: '200 800' },
};

export const FONTS = {
  sans: `'Inter', 'InterVariable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
  serif: `'Newsreader', 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif`,
  mono: `'JetBrains Mono', ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace`,
};

export const THEMES = [
  {
    id: 'aurora',
    name: 'Aurora',
    vibe: 'Soft gradients & glass cards',
    display: FONTS.sans,
    body: FONTS.sans,
    mono: FONTS.mono,
    radius: '18px',
    light: {
      bg: '#f6f7fb', surface: 'rgba(255,255,255,.72)', surfaceSolid: '#ffffff',
      text: '#0f1222', muted: '#5b6178', border: 'rgba(15,18,34,.09)',
      accent: '#6d5efc', accent2: '#22c2c8', shadow: '0 18px 50px -24px rgba(23,20,63,.35)',
      glow: 'radial-gradient(900px 420px at 12% -8%, rgba(109,94,252,.20), transparent 65%), radial-gradient(760px 380px at 92% 2%, rgba(34,194,200,.18), transparent 60%)',
    },
    dark: {
      bg: '#0a0b12', surface: 'rgba(255,255,255,.045)', surfaceSolid: '#12141f',
      text: '#eef0ff', muted: '#a2a8c4', border: 'rgba(255,255,255,.10)',
      accent: '#9b8cff', accent2: '#3ee0e6', shadow: '0 24px 60px -28px rgba(0,0,0,.85)',
      glow: 'radial-gradient(900px 460px at 10% -10%, rgba(109,94,252,.30), transparent 65%), radial-gradient(720px 400px at 95% 0%, rgba(34,194,200,.20), transparent 60%)',
    },
    skin: `
body{background-image:var(--glow);background-attachment:fixed}
.card,.hero-card{border-radius:var(--radius);backdrop-filter:blur(14px);background:var(--surface)}
.hero-card{background:linear-gradient(160deg,var(--surface),transparent),var(--surface)}
.chip{background:color-mix(in srgb, var(--accent) 12%, transparent);border-color:color-mix(in srgb, var(--accent) 26%, transparent);color:var(--text)}
.tag{border-radius:999px}
.nav a{border-radius:999px;background:var(--surface);border-color:var(--border)}
.hero-title{background:linear-gradient(100deg,var(--text),var(--accent) 55%,var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.avatar{box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 20%,transparent)}
`,
  },
  {
    id: 'terminal',
    name: 'Terminal',
    vibe: 'Monospace, prompt lines, green glow',
    display: FONTS.mono,
    body: FONTS.mono,
    mono: FONTS.mono,
    radius: '6px',
    light: {
      bg: '#f4f7f4', surface: '#ffffff', surfaceSolid: '#ffffff',
      text: '#10201a', muted: '#4f6a5e', border: '#cfe0d7',
      accent: '#0f9d58', accent2: '#0b7285', shadow: '0 10px 30px -18px rgba(16,32,26,.45)',
      glow: 'none',
    },
    dark: {
      bg: '#07110d', surface: '#0c1a14', surfaceSolid: '#0c1a14',
      text: '#d6ffe9', muted: '#77a891', border: '#17362a',
      accent: '#39ff9b', accent2: '#4fd6ff', shadow: '0 0 0 1px rgba(57,255,155,.08), 0 18px 40px -24px rgba(0,0,0,.9)',
      glow: 'radial-gradient(700px 340px at 20% -6%, rgba(57,255,155,.10), transparent 70%)',
    },
    skin: `
body{background-image:var(--glow)}
.hero-kicker::before{content:"$ ";color:var(--accent)}
.section-title::before{content:"## ";color:var(--accent);opacity:.7}
.section-title{letter-spacing:-.01em}
.card,.hero-card{border:1px solid var(--border);border-radius:var(--radius)}
.card{box-shadow:none;background:var(--surface)}
.card:hover{border-color:color-mix(in srgb,var(--accent) 55%,var(--border))}
.chip{background:transparent;color:var(--accent);border-color:var(--border)}
.chip::before{content:"> "}
.chip::after{content:""}
.nav a{background:transparent;border-color:var(--border)}
a{text-decoration:none;border-bottom:1px dashed color-mix(in srgb,var(--accent) 50%,transparent)}
.timeline{border-left:1px dashed var(--border)}
.dot{background:var(--accent);box-shadow:0 0 12px var(--accent)}
.hero-title{color:var(--text)}
.avatar{border-radius:var(--radius);filter:saturate(.9)}
`,
  },
  {
    id: 'editorial',
    name: 'Editorial',
    vibe: 'Serif type, rules, magazine grid',
    display: FONTS.serif,
    body: FONTS.serif,
    mono: FONTS.mono,
    radius: '2px',
    light: {
      bg: '#fbf8f2', surface: '#ffffff', surfaceSolid: '#ffffff',
      text: '#1a1712', muted: '#6b6156', border: '#ddd3c4',
      accent: '#8c2f1f', accent2: '#1f4536', shadow: '0 1px 0 rgba(0,0,0,.04)',
      glow: 'none',
    },
    dark: {
      bg: '#141210', surface: '#1c1916', surfaceSolid: '#1c1916',
      text: '#f4ede2', muted: '#b6a897', border: '#352f28',
      accent: '#e7815f', accent2: '#8ec3a5', shadow: '0 1px 0 rgba(0,0,0,.4)',
      glow: 'none',
    },
    skin: `
.hero-title{font-size:clamp(2.6rem,6vw,4.2rem);letter-spacing:-.02em;line-height:1.02}
.hero-kicker{text-transform:uppercase;letter-spacing:.22em;font-size:.72rem;font-family:var(--font-mono)}
.section-title{border-bottom:1px solid var(--border);padding-bottom:.4rem;font-style:italic;letter-spacing:-.01em}
.card{background:transparent;border:none;border-top:1px solid var(--border);border-radius:0;padding:1.1rem 0;box-shadow:none}
.card:hover{background:color-mix(in srgb,var(--accent) 4%,transparent)}
.chip{background:transparent;border:1px solid var(--border);border-radius:0;font-family:var(--font-mono);font-size:.76rem}
.nav a{background:transparent;border-radius:0;border-color:transparent;border-bottom:1px solid var(--border)}
blockquote{border-left:3px solid var(--accent);font-size:1.22rem;font-style:italic;color:var(--text)}
.avatar{border-radius:50%;filter:grayscale(.35) contrast(1.05)}
`,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    vibe: 'Quiet Swiss layout, hairline borders',
    display: FONTS.sans,
    body: FONTS.sans,
    mono: FONTS.mono,
    radius: '10px',
    light: {
      bg: '#ffffff', surface: '#ffffff', surfaceSolid: '#ffffff',
      text: '#111111', muted: '#6f6f6f', border: '#e6e6e6',
      accent: '#111111', accent2: '#6f6f6f', shadow: 'none',
      glow: 'none',
    },
    dark: {
      bg: '#0c0c0c', surface: '#141414', surfaceSolid: '#141414',
      text: '#f2f2f2', muted: '#9a9a9a', border: '#242424',
      accent: '#ffffff', accent2: '#a8a8a8', shadow: 'none',
      glow: 'none',
    },
    skin: `
.hero-title{font-weight:600;letter-spacing:-.035em;font-size:clamp(2.2rem,5vw,3.6rem)}
.hero-kicker{font-weight:500;color:var(--muted)}
.section-title{font-size:1rem;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);font-weight:500}
.card{border:1px solid var(--border);border-radius:var(--radius);background:transparent;box-shadow:none}
.card:hover{border-color:var(--text)}
.chip{background:transparent;border:1px solid var(--border);color:var(--text);border-radius:999px}
.nav a{border-color:transparent;background:transparent;color:var(--muted)}
.nav a:hover{color:var(--text)}
a{text-decoration:none;box-shadow:inset 0 -1px 0 var(--border)}
a:hover{box-shadow:inset 0 -1px 0 var(--text)}
.avatar{border-radius:var(--radius)}
.hero-card{background:transparent;border:none}
`,
  },
  {
    id: 'neon',
    name: 'Neon Grid',
    vibe: 'Cyberpunk grid, glowing edges',
    display: FONTS.mono,
    body: FONTS.sans,
    mono: FONTS.mono,
    radius: '4px',
    light: {
      bg: '#f2f2ff', surface: '#ffffff', surfaceSolid: '#ffffff',
      text: '#1b1440', muted: '#5f5891', border: '#d6d0ff',
      accent: '#7b2ff7', accent2: '#ff2e97', shadow: '0 0 0 1px rgba(123,47,247,.12)',
      glow: 'linear-gradient(rgba(123,47,247,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(123,47,247,.06) 1px, transparent 1px)',
    },
    dark: {
      bg: '#07030f', surface: 'rgba(123,47,247,.07)', surfaceSolid: '#0d0719',
      text: '#f3ecff', muted: '#a99bce', border: 'rgba(255,46,151,.22)',
      accent: '#c04bff', accent2: '#00e5ff', shadow: '0 0 24px -8px rgba(192,75,255,.55)',
      glow: 'linear-gradient(rgba(192,75,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(192,75,255,.07) 1px, transparent 1px)',
    },
    skin: `
body{background-size:38px 38px,38px 38px;background-image:var(--glow)}
.hero-title{text-shadow:0 0 26px color-mix(in srgb,var(--accent) 45%,transparent);letter-spacing:-.02em}
.section-title{text-transform:uppercase;letter-spacing:.16em;font-size:.86rem;color:var(--accent)}
.card,.hero-card{border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow)}
.card:hover{box-shadow:0 0 30px -6px color-mix(in srgb,var(--accent2) 60%,transparent);border-color:var(--accent2)}
.chip{background:color-mix(in srgb,var(--accent) 14%,transparent);border:1px solid var(--border);border-radius:2px;font-family:var(--font-mono);text-transform:uppercase;font-size:.7rem;letter-spacing:.06em}
.nav a{background:transparent;border:1px solid var(--border);border-radius:2px;text-transform:uppercase;font-size:.72rem;letter-spacing:.08em;font-family:var(--font-mono)}
.dot{box-shadow:0 0 14px var(--accent2)}
.avatar{filter:contrast(1.1) saturate(1.2)}
`,
  },
  {
    id: 'sunset',
    name: 'Sunset Card',
    vibe: 'Warm, rounded, friendly',
    display: FONTS.sans,
    body: FONTS.sans,
    mono: FONTS.mono,
    radius: '26px',
    light: {
      bg: '#fff6f0', surface: '#ffffff', surfaceSolid: '#ffffff',
      text: '#2a1a12', muted: '#8a6a58', border: 'rgba(42,26,18,.10)',
      accent: '#f2743b', accent2: '#e0356b', shadow: '0 20px 45px -26px rgba(120,50,20,.45)',
      glow: 'radial-gradient(780px 380px at 100% 0%, rgba(242,116,59,.22), transparent 60%), radial-gradient(680px 340px at 0% 6%, rgba(224,53,107,.14), transparent 60%)',
    },
    dark: {
      bg: '#160f0c', surface: 'rgba(255,255,255,.05)', surfaceSolid: '#1f1611',
      text: '#fff1e8', muted: '#c4a595', border: 'rgba(255,255,255,.10)',
      accent: '#ff8a5c', accent2: '#ff5d8f', shadow: '0 26px 60px -30px rgba(0,0,0,.9)',
      glow: 'radial-gradient(780px 380px at 100% 0%, rgba(255,138,92,.18), transparent 60%), radial-gradient(680px 340px at 0% 6%, rgba(255,93,143,.14), transparent 60%)',
    },
    skin: `
body{background-image:var(--glow);background-attachment:fixed}
.hero-card,.card{border-radius:var(--radius);background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow)}
.hero-card{background:linear-gradient(150deg,color-mix(in srgb,var(--accent) 14%,var(--surface)),var(--surface) 60%)}
.chip{background:color-mix(in srgb,var(--accent2) 12%,transparent);border-color:color-mix(in srgb,var(--accent2) 25%,transparent);border-radius:999px}
.nav a{border-radius:999px;background:var(--surface);border-color:var(--border)}
.dot{background:linear-gradient(var(--accent),var(--accent2))}
.avatar{border-radius:32px;box-shadow:0 12px 30px -14px rgba(0,0,0,.4)}
`,
  },
];

export const getTheme = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
