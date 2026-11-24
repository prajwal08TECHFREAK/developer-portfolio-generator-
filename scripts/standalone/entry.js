/**
 * Entry point for the standalone / single-file build.
 *
 * Bundles the same React components and libs the Next app uses, but without the
 * Next runtime — so the result is one self-contained HTML file that runs from a
 * zip, a file path, an email attachment or an iframe sandbox.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import Studio from '../../components/Studio';
import { loadStudioFonts } from '../../lib/fonts.js';

// Full-screen preview: instead of navigating to the /preview/ route, open a
// blob URL containing the compiled document.
window.__pfStandaloneOpen = (html) => {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

const mount = () => {
  loadStudioFonts();
  const el = document.getElementById('pf-root');
  if (!el) {
    if (window.__pfBoot) window.__pfBoot.fail('Missing mount point (#pf-root).');
    return;
  }
  createRoot(el).render(React.createElement(Studio));
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
