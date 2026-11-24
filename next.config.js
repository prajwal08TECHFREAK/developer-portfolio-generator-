/** @type {import('next').NextConfig} */
// Static export: `npm run build` writes a fully static site to ./out
// (no Node runtime needed — parses markdown, renders themes and publishes
// to GitHub entirely in the browser), ready for GitHub Pages / any CDN.
// Override the base path when the site lives under a sub-path:
//   BASE_PATH=/my-repo npm run build
const basePath = process.env.BASE_PATH || '';

const nextConfig = {
  output: 'export',
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  reactStrictMode: true,
};

module.exports = nextConfig;
