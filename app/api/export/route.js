import { compilePortfolio } from '../../../lib/markdown';
import { renderDocument } from '../../../lib/render';
import { exportFiles, publishFiles } from '../../../lib/publish-files';

export const runtime = 'nodejs';

/** POST { markdown, options } -> { files: { path: content } } */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const { markdown = '', options = {}, mode = 'site' } = body || {};
  const overrides = options.sections || {};
  const data = compilePortfolio(markdown, {
    sectionOrder: options.sectionOrder,
    hidden: Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, !!(v && v.hidden)])),
    titles: Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, (v && v.title) || ''])),
  });
  const files = mode === 'publish' ? publishFiles({ markdown, options }) : exportFiles({ html: renderDocument(data, options), markdown, options });
  return Response.json({ files, sections: data.sections.length });
}
