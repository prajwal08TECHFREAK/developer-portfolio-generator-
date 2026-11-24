export const DEFAULT_OPTIONS = {
  themeId: 'aurora',
  mode: 'light',
  accent: '',
  accent2: '',
  fontDisplay: 'sans',
  fontBody: 'sans',
  radius: 'default',
  density: 'cozy',
  width: 'regular',
  showNav: true,
  showAvatar: true,
  showMeta: true,
  showIntro: true,
  showLocation: true,
  numberHeadings: false,
  sections: {},
  sectionOrder: [],
  name: '',
  role: '',
  tagline: '',
};

export function normalizeOptions(o = {}) {
  return { ...DEFAULT_OPTIONS, ...o, sections: { ...(o.sections || {}) } };
}
