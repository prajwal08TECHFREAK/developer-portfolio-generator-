import { compilePortfolio } from '../../../lib/markdown';
import { renderDocument } from '../../../lib/render';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const { markdown = '', options = {} } = body || {};
  const overrides = options.sections || {};
  const data = compilePortfolio(markdown, {
    sectionOrder: options.sectionOrder,
    hidden: Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, !!(v && v.hidden)])),
    titles: Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, (v && v.title) || ''])),
  });
  const html = renderDocument(data, options);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
