import { compilePortfolio } from '../../../lib/markdown';

/** POST { markdown } -> parsed model (profile, sections, kinds) */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const data = compilePortfolio(body?.markdown || '', { sectionOrder: body?.options?.sectionOrder });
  const sections = data.sections.map((s) => ({ id: s.id, title: s.title, kind: s.kind, hidden: s.hidden }));
  return Response.json({ profile: data.profile, sections, hasFrontMatter: /^---/.test(String(body?.markdown || '').trim()) });
}
