'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function PreviewInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [html, setHtml] = useState(null);

  useEffect(() => {
    const fromSession = sessionStorage.getItem('pf:html');
    const fromQuery = params.get('h');
    const doc = fromQuery ? decodeURIComponent(fromQuery) : fromSession;
    if (doc) setHtml(doc);
    else router.replace('/');
  }, [params, router]);

  if (!html) {
    return <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#0b0c12', color: '#94a3b8', fontFamily: 'system-ui' }}>Loading preview…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', background: '#0b0c12', borderBottom: '1px solid #232636', fontFamily: 'system-ui', fontSize: 12, color: '#94a3b8' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #2b3049', color: '#cbd5e1', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 11 }}>
          ← Back to editor
        </button>
        <span>Full-screen preview · exactly what gets published</span>
      </div>
      <iframe title="Portfolio" srcDoc={html} style={{ flex: 1, width: '100%', border: 0 }} sandbox="allow-scripts allow-popups" />
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={null}>
      <PreviewInner />
    </Suspense>
  );
}
