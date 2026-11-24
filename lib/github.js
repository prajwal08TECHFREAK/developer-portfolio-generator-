/**
 * Browser-side GitHub publisher.
 *
 * Same flow as the server route, but it runs entirely in the browser so the app
 * can be hosted as a static site (GitHub Pages) with no backend at all:
 *
 *   token -> GET /user -> ensure repo -> blobs -> tree -> commit -> ref -> Pages
 *
 * The token never leaves the browser except in direct calls to api.github.com.
 */

const API = 'https://api.github.com';

async function gh(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {object} opts
 * @param {string} opts.token       GitHub PAT (classic `repo`, or fine-grained Contents: RW)
 * @param {string} opts.repo        repository name (no owner)
 * @param {boolean} opts.private    create as private repo
 * @param {string} opts.description repo description
 * @param {string} opts.html        generated index.html
 * @param {object} opts.files       extra path -> content map
 * @param {string} opts.message     commit message
 * @param {(step:{name:string,ok:boolean,detail?:string})=>void} [opts.onStep]
 */
export async function publishToGitHub(opts) {
  const {
    token,
    repo,
    private: isPrivate = false,
    description = '',
    html,
    files = {},
    message = 'chore: publish portfolio',
    branch: branchPref,
    onStep = () => {},
  } = opts || {};

  const step = (name, ok, detail = '') => onStep({ name, ok, detail });

  if (!token) throw new Error('A GitHub personal access token is required (classic with `repo` scope, or fine-grained with Contents: read/write).');
  if (!repo || !/^[A-Za-z0-9._-]{1,100}$/.test(repo)) throw new Error('Repo name must be 1–100 chars: letters, numbers, dot, dash or underscore.');
  if (!html) throw new Error('Nothing to publish — the generated HTML was empty.');

  // 1. who am I
  const me = await gh(token, '/user');
  if (!me.ok) {
    throw new Error(
      me.status === 401
        ? 'GitHub rejected the token (401). Check it is not expired and has the right scopes.'
        : `Could not read GitHub user (${me.status} ${me.json?.message || ''}).`
    );
  }
  const owner = me.json.login;
  step({ name: 'Authenticated', ok: true, detail: `@${owner}` });

  // 2. repo (create when missing)
  let info = await gh(token, `/repos/${owner}/${repo}`);
  let createdRepo = false;
  if (info.status === 404) {
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
      throw new Error(
        `Could not create repository: ${created.json?.message || created.status}` +
          (created.status === 403 ? ' — the token needs Administration: write to create repos.' : '')
      );
    }
    info = created;
    createdRepo = true;
    step({ name: 'Repository created', ok: true, detail: `${owner}/${repo}` });
    await sleep(1200);
  } else if (info.ok) {
    step({ name: 'Repository found', ok: true, detail: `${owner}/${repo}` });
  } else {
    throw new Error(`Could not access repository: ${info.json?.message || info.status}`);
  }

  const fullName = info.json.full_name || `${owner}/${repo}`;
  const branch = branchPref || info.json.default_branch || 'main';

  // 3. current head (tolerates an empty repo)
  let parentSha = null;
  let baseTree = null;
  const ref = await gh(token, `/repos/${fullName}/git/ref/heads/${branch}`);
  if (ref.ok) {
    parentSha = ref.json.object.sha;
    const commit = await gh(token, `/repos/${fullName}/git/commits/${parentSha}`);
    if (commit.ok) baseTree = commit.json.tree.sha;
    step({ name: 'Loaded current branch', ok: true, detail: `${branch} @ ${parentSha.slice(0, 7)}` });
  } else {
    step({ name: 'Branch is empty', ok: true, detail: `creating ${branch}` });
  }

  // 4. blobs
  const payload = { 'index.html': html, '.nojekyll': '', ...files };
  const blobs = [];
  for (const [path, content] of Object.entries(payload)) {
    if (path.includes('..')) continue;
    const res = await gh(token, `/repos/${fullName}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: typeof content === 'string' ? content : String(content), encoding: 'utf-8' }),
    });
    if (!res.ok) throw new Error(`Failed to upload ${path}: ${res.json?.message || res.status}`);
    blobs.push({ path, mode: '100644', type: 'blob', sha: res.json.sha });
  }
  step({ name: 'Files uploaded', ok: true, detail: `${blobs.length} files` });

  // 5. tree -> commit -> ref
  const tree = await gh(token, `/repos/${fullName}/git/trees`, {
    method: 'POST',
    body: JSON.stringify(baseTree ? { base_tree: baseTree, tree: blobs } : { tree: blobs }),
  });
  if (!tree.ok) throw new Error(`Failed to build tree: ${tree.json?.message || tree.status}`);

  const commit = await gh(token, `/repos/${fullName}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: message || 'chore: publish portfolio',
      tree: tree.json.sha,
      parents: parentSha ? [parentSha] : [],
    }),
  });
  if (!commit.ok) throw new Error(`Failed to create commit: ${commit.json?.message || commit.status}`);
  step({ name: 'Commit created', ok: true, detail: commit.json.sha.slice(0, 7) });

  if (parentSha) {
    const updated = await gh(token, `/repos/${fullName}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.json.sha, force: false }),
    });
    if (!updated.ok) throw new Error(`Failed to update branch: ${updated.json?.message || updated.status}`);
    step({ name: 'Branch updated', ok: true, detail: branch });
  } else {
    const created = await gh(token, `/repos/${fullName}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.json.sha }),
    });
    if (!created.ok) throw new Error(`Failed to create branch: ${created.json?.message || created.status}`);
    step({ name: 'Branch created', ok: true, detail: branch });
  }

  // 6. GitHub Pages
  let pagesUrl = null;
  let pagesNote = '';
  if (!isPrivate) {
    const body = JSON.stringify({ source: { branch, path: '/' } });
    let pages = await gh(token, `/repos/${fullName}/pages`, { method: 'POST', body });
    if (pages.status === 409) pages = await gh(token, `/repos/${fullName}/pages`, { method: 'PUT', body });
    if (pages.ok || pages.status === 204) {
      const info2 = await gh(token, `/repos/${fullName}/pages`);
      pagesUrl = info2.ok ? info2.json.html_url : `https://${owner}.github.io/${repo}/`;
      step({ name: 'GitHub Pages enabled', ok: true, detail: pagesUrl });
    } else {
      pagesNote = `Published, but Pages could not be enabled automatically (${pages.json?.message || pages.status}). Settings → Pages → Deploy from branch → ${branch} /(root).`;
      step({ name: 'GitHub Pages', ok: false, detail: pagesNote });
    }
  } else {
    pagesNote = 'Private repo: GitHub Pages needs a paid plan. The files are pushed and ready.';
    step({ name: 'GitHub Pages skipped', ok: true, detail: 'private repo' });
  }

  return {
    ok: true,
    owner,
    repo,
    fullName,
    branch,
    createdRepo,
    repoUrl: info.json.html_url || `https://github.com/${fullName}`,
    commitUrl: `https://github.com/${fullName}/commit/${commit.json.sha}`,
    pagesUrl,
    pagesNote,
    next: pagesUrl ? [`Live site: ${pagesUrl}`, 'First publish can take 1–2 minutes to go live.'] : [pagesNote],
  };
}

/** Cheap token check used by the Publish tab's "Test token" button. */
export async function checkToken(token) {
  if (!token) throw new Error('Paste a token first.');
  const res = await gh(token, '/user');
  if (!res.ok) throw new Error(res.status === 401 ? 'Token rejected (401).' : `GitHub error ${res.status}.`);
  return { login: res.json.login, name: res.json.name, avatar: res.json.avatar_url };
}
