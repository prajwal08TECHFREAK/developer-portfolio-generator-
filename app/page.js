import Studio from '../components/Studio';
import { compilePortfolio } from '../lib/markdown';
import { SAMPLE_MD } from '../lib/sample';
import { DEFAULT_OPTIONS } from '../lib/options';

export default function Page() {
  const data = compilePortfolio(SAMPLE_MD, {});
  const initialSections = data.sections.map((s) => ({ id: s.id, title: s.title, kind: s.kind, hidden: s.hidden }));
  return (
    <Studio
      sampleMd={SAMPLE_MD}
      defaults={DEFAULT_OPTIONS}
      initialSections={initialSections}
      initialProfile={data.profile}
    />
  );
}
