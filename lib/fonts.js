import { FONT_FILES } from './themes.js';

/**
 * Loads the theme fonts for the studio UI (self-hosted variable woff2 files from
 * /public/fonts). Exported sites inline the same files as data URIs instead,
 * so a published portfolio never depends on a CDN.
 */
export function loadStudioFonts() {
  if (typeof document === 'undefined' || document.getElementById('pf-fonts')) return;
  const prefix = process.env.NEXT_PUBLIC_ASSET_PREFIX;
  const base = prefix !== undefined ? prefix : process.env.NEXT_PUBLIC_BASE_PATH || '';
  const faces = Object.values(FONT_FILES)
    .map(
      (f) => `@font-face{font-family:'${f.family}';font-style:normal;font-display:swap;font-weight:${f.weight};
        src:url('${base}${f.file}') format('woff2');}`
    )
    .join('\n');
  const style = document.createElement('style');
  style.id = 'pf-fonts';
  style.textContent = faces;
  document.head.appendChild(style);
}
