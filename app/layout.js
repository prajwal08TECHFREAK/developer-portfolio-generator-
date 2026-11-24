export const metadata = {
  title: 'Portfolio Forge — Markdown → developer portfolio',
  description:
    'Paste a Markdown résumé, pick a theme, preview it live and publish it to GitHub Pages in one click.',
};

import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
