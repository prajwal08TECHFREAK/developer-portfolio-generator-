'use client';

import dynamic from 'next/dynamic';

// The studio is a browser app (parser + renderer + GitHub client all run locally),
// so it is loaded client-side. That keeps the exported HTML a tiny shell instead
// of embedding the sample résumé in the page payload.
const Studio = dynamic(() => import('../components/Studio'), {
  ssr: false,
  loading: () => (
    <div className="grid h-screen place-items-center bg-ink">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
        Loading Portfolio Forge…
      </div>
    </div>
  ),
});

export default function Page() {
  return <Studio initialSections={[]} />;
}
