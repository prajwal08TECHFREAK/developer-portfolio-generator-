import './globals.css';

export const metadata = {
  title: 'Portfolio Forge — Markdown → developer portfolio',
  description:
    'Paste a Markdown résumé, pick a theme, preview it live and publish it to GitHub Pages in one click.',
};

// Boot screen markup lives in its own module so the standalone / single-file
// build renders exactly the same screen.
import { BOOT_STYLES, BOOT_MARKUP, BOOT_SCRIPT } from '../lib/boot.js';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: BOOT_STYLES }} />
      </head>
      <body>
        <div dangerouslySetInnerHTML={{ __html: BOOT_MARKUP }} />
        {children}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </body>
    </html>
  );
}
