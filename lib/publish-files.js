/** Extra files pushed alongside index.html so the repo is self-documenting + deployable. */
export function publishFiles({ markdown, options }) {
  const workflow = `name: Deploy portfolio to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - id: deployment
        uses: actions/deploy-pages@v4
`;

  const readme = `# ${options.name || 'Portfolio'}

Generated with **Portfolio Forge** — Markdown in, hosted portfolio out.

- \`index.html\` — the entire site (self-contained, no build step, no dependencies)
- \`portfolio.md\` — the source Markdown, edit this and re-publish to update
- \`.github/workflows/deploy.yml\` — optional GitHub Actions deploy

## Hosting

GitHub Pages → Settings → Pages → Source: *Deploy from a branch* → \`main\` / \`(root)\`.

If Pages is served through a workflow instead, the included action publishes the repo root on every push.

## Update the site

Re-run the generator with your edited \`portfolio.md\`, or hand-edit \`index.html\`.
`;

  const gitignore = `.DS_Store\nThumbs.db\nnode_modules/\n`;

  return {
    'portfolio.md': markdown,
    'README.md': readme,
    '.gitignore': gitignore,
    '.github/workflows/deploy.yml': workflow,
  };
}

export function exportFiles({ html, markdown, options }) {
  return {
    'index.html': html,
    'portfolio.md': markdown,
    ...publishFiles({ markdown, options }),
  };
}
