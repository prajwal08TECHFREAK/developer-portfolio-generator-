'use client';

import Studio from '../components/Studio';

// The studio is a browser app: parsing, rendering and publishing all happen locally.
// Rendering it directly (instead of a dynamic import) means the shell exists on the
// very first paint — the boot screen in layout.js hands over as soon as it mounts.
export default function Page() {
  return <Studio />;
}
