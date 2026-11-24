# Testing Portfolio Forge

The app is fully client-side, so there are three layers: offline pipeline tests, browser/UI checks, and the real GitHub publish.

---

## 1. Offline pipeline tests (no build needed)

```bash
npm install
npm run check
```

`scripts/check-export.mjs` imports the actual library modules and asserts:

- front matter + all 7 sample sections classified (`about`, `skills`, `projects`, `experience`, `education`, `contact`)
- all 6 themes × light/dark produce a complete document, correct `data-theme`/`data-mode`, **no `<script src>`, no external stylesheet**
- rename / hide / reorder / numbered headings / accent override reach the output
- export bundle contains `index.html`, `portfolio.md`, `README.md`, `.gitignore`, Pages workflow
- edge cases: no front matter (H1 becomes the name), GFM tables, task lists, empty markdown

Expected: `23 passed, 0 failed`.

---

## 2. Static export + served instance

```bash
npm run build:docs                  # → out/ + docs/app (portable build)
npm run serve                       # http://localhost:3000 (serves ./out)
./scripts/smoke-test.sh http://localhost:3000
./scripts/smoke-test.sh             # checks ./out + docs/app without a server
```

Offline check (no server at all): open `docs/app/index.html` or `index.html` straight from disk — the studio must load, render the sample preview, switch themes and download `index.html` with fonts embedded (that is the file:// path, `npm run build:offline` produces it).

`scripts/smoke-test.sh` checks that:

- `index.html`, `404.html`, `.nojekyll`, `preview/index.html` exist
- every `/_next/...` asset referenced by those pages actually exists (catches broken `basePath` builds)
- the app references **no `/api/` routes** (i.e. it really is static)
- the export is under 8 MB (~1.1 MB today)
- the served instance answers 200 for `/` and `/preview/`, and the JS chunk loads
- the offline pipeline suite still passes

Expected: `14 passed, 0 failed` (10 when you skip the URL argument).

To rehearse the GitHub Pages sub-path, build and serve under a folder (the app must be reachable at the *same* path it will have in production, e.g. `/portfolio-forge/app/` when using `npm run build:docs`):

```bash
BASE_PATH=/my-repo npm run build
mkdir -p /tmp/site && cp -r out /tmp/site/my-repo
(cd /tmp/site && npx --yes serve@14 . -l 3101)
open http://localhost:3101/my-repo/
```

Browser-side checks worth repeating after any change to the renderer: preview live-updates, theme switch, rename/hide/reorder, **↓ index.html** (must open offline with embedded fonts), **↓ Project .zip**, **Open full screen** (`/preview/` renders the same document), and **Test token** against a real token.

---

## 3. Manual UI checklist

`npm run dev` → http://localhost:3000.

**Content**
- [ ] Sample résumé loads; preview appears immediately.
- [ ] Typing updates the preview live; badge shows `saved locally`.
- [ ] **Import .md** with `examples/sample-resume.md`; drag a `.md` file onto the editor.
- [ ] **Blank** gives a starter file; **Sample** restores the demo.
- [ ] Delete the closing `---` of the front matter → red hint appears, app keeps working.
- [ ] Reload → draft/theme/sections persist. **Reset** clears them.

**Design**
- [ ] All six themes restyle instantly; light/dark works on each.
- [ ] Accent swatches change the palette; `reset` restores the theme colours.
- [ ] Density / corners / width / fonts change layout; type renders in Inter / Newsreader / JetBrains Mono (self-hosted).
- [ ] Element toggles remove the nav bar, avatar, hero intro, contact buttons.
- [ ] Viewport buttons (▢ ▭ ⛶) resize the preview frame.

**Sections**
- [ ] Rename *Projects* → heading changes, your Markdown does not.
- [ ] Hide *Education* → gone; show again → back.
- [ ] ↑/↓ reorders sections and the nav.
- [ ] **Outline** tab shows a mini-render of each section with the same controls.
- [ ] Rename a heading in the Markdown itself → the section list updates.

**Export**
- [ ] **↓ index.html** → one file, opens offline, styled, fonts embedded (no network), no console errors.
- [ ] **↓ Project .zip** → unzip → `index.html` + `portfolio.md` + README + workflow.
- [ ] **Copy HTML** → paste → identical document.
- [ ] **Open full screen** → `/preview/` shows exactly what gets published; print preview is clean.

**Mobile**
- [ ] Below 640 px the editor fills the screen; floating **Preview site ↗** opens the full-screen preview.

---

## 4. Testing the real GitHub publish

Use a throwaway repo the first time.

1. Token: <https://github.com/settings/tokens/new?scopes=repo> (classic, `repo` scope) — or fine-grained with **Contents: Read & write** + **Administration: Read & write** (the second one is only needed for repository creation).
2. **Publish** tab → paste → **Test token** → expect `signed in as @you`.
3. Repo name `pf-test-<you>` → **Deploy to GitHub Pages**.
4. Watch the checklist: `Authenticated → Repository created → Files uploaded → Commit created → Branch created → GitHub Pages enabled`.
5. Open the repo (5 files) and the Pages URL (first publish takes 1–2 minutes).
6. Change a theme and publish again → a **second commit** on the same branch, no force push.
7. Failure paths: an invalid token (`Test token` shows *Token rejected (401)*), a repo name with spaces (rejected before any request), a token without `repo` scope (403 message, nothing half-written beyond an empty repo).

**Deployed portfolio checklist**
- [ ] Loads over https, no mixed-content warnings.
- [ ] Nav links scroll; project links open in new tabs.
- [ ] View source: single `<style>` block, fonts inlined as data URIs, no external CSS/JS/CDN.
- [ ] Lighthouse mobile: no console errors, no layout shift from the avatar.
- [ ] Share the URL in a chat app → Open Graph title/description (and image when `avatar:` is set).

---

## 5. Known-good baseline

Clean checkout, `npm ci`:

```
npm run check                                    → 23 passed, 0 failed
npm run build:docs
./scripts/smoke-test.sh                           → 17 passed, 0 failed
./scripts/smoke-test.sh http://localhost:3000     → 21 passed, 0 failed
```

If a render assertion fails, the stack trace will point at `lib/render.js` / `lib/markdown.js` — both are pure functions with no external state. A stale build is the usual culprit: `rm -rf .next out && npm run build`.
