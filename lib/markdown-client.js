import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

/** Browser-side markdown → HTML (same pipeline as the server). */
export function mdToHtml(md = '') {
  try {
    return String(
      unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeStringify, { allowDangerousHtml: true })
        .processSync(md || '')
    );
  } catch (err) {
    return `<p class="error">Could not parse markdown: ${String(err.message || err)}</p>`;
  }
}
