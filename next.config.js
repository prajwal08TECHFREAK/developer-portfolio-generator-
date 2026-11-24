/** @type {import('next').NextConfig} */
// Static export: `npm run build` writes a fully static site to ./out
// (no Node runtime needed — parses markdown, renders themes and publishes
// to GitHub entirely in the browser), ready for GitHub Pages / any CDN.
// Override the base path when the site lives under a sub-path:
//   BASE_PATH=/my-repo npm run build
const basePath = process.env.BASE_PATH || '';
// REL_ASSETS=1 rewrites asset URLs to relative ones so the export also works
// when opened straight from disk (file://…/index.html) or in any sub-folder.
const relAssets = process.env.REL_ASSETS === '1';
// SINGLE_FILE=1 inlines every JS/CSS chunk into the HTML (see scripts/make-single-file.mjs),
// so the app is one portable .html file — works from a zip, an email attachment or a sandbox.
const singleFile = process.env.SINGLE_FILE === '1';

const nextConfig = {
  output: 'export',
  env: { NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_ASSET_PREFIX: relAssets ? '.' : basePath },
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  ...(singleFile
    ? {
        experimental: { inlineCss: true },
        webpack: (config) => {
          // no code splitting: one bundle per chunk group, easy to inline
          config.optimization.splitChunks = false;
          config.optimization.runtimeChunk = false;
          return config;
        },
      }
    : {}),
  ...(relAssets
    ? {
        assetPrefix: '.',
        webpack: (config) => {
          config.output.publicPath = './_next/';
          return config;
        },
      }
    : {}),
  reactStrictMode: true,
};

module.exports = nextConfig;
