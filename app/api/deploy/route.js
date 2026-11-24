import { NextResponse } from 'next/server';
export const runtime = 'nodejs';

const API = 'https://api.github.com';

async function gh(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'portfolio-forge',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }
  return { ok: res.ok, status: res.status, json };
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { token, repo, private: isPrivate = false, description = '', html, files = {}, message = 'chore: publish portfolio via Portfolio Forge', branch: branchPref } = body || {};

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'A GitHub personal access token is required (classic with `repo` scope, or fine-grained with Contents: read/write).' }, { status: 400 });
  }
  if (!repo || !/^[A-Za-z0-9._-]{1,100}$/.test(repo)) {
    return NextResponse.json({ error: 'Repo name must be 1–100 chars: letters, numbers, dot, dash or underscore.' }, { status: 400 });
  }
  if (!html || typeof html !== 'string') {
    return NextResponse.json({ error: 'Nothing to deploy — the generated HTML was empty.' }, { status: 400 });
  }

  const steps = [];
  const step = (name, ok, detail = '') => steps.push({ name, ok, detail });

  try {
    // 1. whoami
    const me = await gh(token, '/user');
    if (!me.ok) {
      return NextResponse.json(
        { error: me.status === 401 ? 'GitHub rejected the token (401). Check it has not expired and has the right scopes.' : `Could not read GitHub user (${me.status}).`, steps },
        { status: 401 }
      );
    }
    const owner = me.json.login;
    step('Authenticated', true, `@${owner}`);

    // 2. repo
    let repoInfo = await gh(token, `/repos/${owner}/${repo}`);
    let createdRepo = false;
    if (repoInfo.status === 404) {
      const created = await gh(token, '/user/repos', {
        method: 'POST',
        body: JSON.stringify({
          name: repo,
          description: description || 'My developer portfolio',
          private: !!isPrivate,
          auto_init: false,
          has_issues: true,
          has_wiki: false,
        }),
      });
      if (!created.ok) {
        return NextResponse.json({ error: `Could not create repository: ${created.json?.message || created.status}`, steps }, { status: 400 });
      }
      repoInfo = created;
      createdRepo = true;
      step('Repository created', true, `${owner}/${repo}`);
      await new Promise((r) => setTimeout(r, 1200));
    } else if (repoInfo.ok) {
      step('Repository found', true, `${owner}/${repo}`);
    } else {
      return NextResponse.json({ error: `Could not access repository: ${repoInfo.json?.message || repoInfo.status}`, steps }, { status: 400 });
    }

    const fullName = repoInfo.json.full_name || `${owner}/${repo}`;
    const branch = branchPref || repoInfo.json.default_branch || 'main';

    // 3. current head (may be empty repository)
    let parentSha = null;
    let baseTree = null;
    const ref = await gh(token, `/repos/${fullName}/git/ref/heads/${branch}`);
    if (ref.ok) {
      parentSha = ref.json.object.sha;
      const commit = await gh(token, `/repos/${fullName}/git/commits/${parentSha}`);
      if (commit.ok) baseTree = commit.json.tree.sha;
      step('Loaded current branch', true, `${branch} @ ${parentSha.slice(0, 7)}`);
    } else {
      step('Branch is empty', true, `creating ${branch}`);
    }

    // 4. payload: site + automation files
    const payload = {
      'index.html': html,
      '.nojekyll': '',
      ...files,
    };

    const blobs = [];
    for (const [path, content] of Object.entries(payload)) {
      if (path.includes('..')) continue;
      const res = await gh(token, `/repos/${fullName}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: typeof content === 'string' ? content : String(content), encoding: 'utf-8' }),
      });
      if (!res.ok) {
        return NextResponse.json({ error: `Failed to upload ${path}: ${res.json?.message || res.status}`, steps }, { status: 400 });
      }
      blobs.push({ path, mode: '100644', type: 'blob', sha: res.json.sha });
    }
    step('Files uploaded', true, `${blobs.length} files`);

    // 5. tree -> commit -> ref
    const tree = await gh(token, `/repos/${fullName}/git/trees`, {
      method: 'POST',
      body: JSON.stringify(baseTree ? { base_tree: baseTree, tree: blobs } : { tree: blobs }),
    });
    if (!tree.ok) {
      return NextResponse.json({ error: `Failed to build tree: ${tree.json?.message || tree.status}`, steps }, { status: 400 });
    }

    const commit = await gh(token, `/repos/${fullName}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message: message || 'chore: publish portfolio',
        tree: tree.json.sha,
        parents: parentSha ? [parentSha] : [],
      }),
    });
    if (!commit.ok) {
      return NextResponse.json({ error: `Failed to create commit: ${commit.json?.message || commit.status}`, steps }, { status: 400 });
    }
    step('Commit created', true, commit.json.sha.slice(0, 7));

    if (parentSha) {
      const updated = await gh(token, `/repos/${fullName}/git/refs/heads/${branch}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.json.sha, force: false }),
      });
      if (!updated.ok) {
        return NextResponse.json({ error: `Failed to update branch: ${updated.json?.message || updated.status}`, steps }, { status: 400 });
      }
      step('Branch updated', true, branch);
    } else {
      const created = await gh(token, `/repos/${fullName}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.json.sha }),
      });
      if (!created.ok) {
        return NextResponse.json({ error: `Failed to create branch: ${created.json?.message || created.status}`, steps }, { status: 400 });
      }
      step('Branch created', true, branch);
    }

    // 6. GitHub Pages
    let pagesUrl = null;
    let pagesNote = '';
    if (!isPrivate) {
      const pagesBody = JSON.stringify({ source: { branch, path: '/' } });
      let pages = await gh(token, `/repos/${fullName}/pages`, { method: 'POST', body: pagesBody });
      if (pages.status === 409) {
        pages = await gh(token, `/repos/${fullName}/pages`, { method: 'PUT', body: pagesBody });
      }
      if (pages.ok || pages.status === 204) {
        const info = await gh(token, `/repos/${fullName}/pages`);
        pagesUrl = info.ok ? info.json.html_url : `https://${owner}.github.io/${repo}/`;
        step('GitHub Pages enabled', true, pagesUrl);
      } else {
        pagesNote = `Deployed, but Pages could not be enabled automatically (${pages.json?.message || pages.status}). Turn it on in Settings → Pages → Deploy from branch → ${branch} /(root).`;
        step('GitHub Pages', false, pagesNote);
      }
    } else {
      pagesNote = 'Private repo: GitHub Pages needs a paid plan. The files are pushed and ready.';
      step('GitHub Pages skipped', true, 'private repo');
    }

    return NextResponse.json({
      ok: true,
      owner,
      repo,
      fullName,
      branch,
      createdRepo,
      repoUrl: repoInfo.json.html_url || `https://github.com/${fullName}`,
      commitUrl: `https://github.com/${fullName}/commit/${commit.json.sha}`,
      pagesUrl,
      pagesNote,
      steps,
      next: pagesUrl ? [`Live site: ${pagesUrl}`, 'First publish can take 1–2 minutes to go live.'] : [pagesNote],
    });
  } catch (err) {
    return NextResponse.json({ error: `Deploy failed: ${String(err.message || err)}`, steps }, { status: 500 });
  }
}

/** GET ?download=1 produces a zip of a static site; used by the Download button. */
export async function GET(req) {
  const url = new URL(req.url);
  if (url.searchParams.get('download') !== '1') {
    return NextResponse.json({ ok: true, hint: 'POST a payload to publish; GET ?download=1 for a zip.' });
  }
  return NextResponse.json({ error: 'Use the Download button in the app.' }, { status: 400 });
}
