import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useInkwell } from '../store/inkwellStore';
import {
  CornerOrnament,
  FleuronDivider,
  QuillIllustration,
  WaxSeal,
} from '../components/ornaments/Ornaments';
import { formatWordCount } from '../lib/formatters';

interface PlaceholderStudioPageProps {
  romanIndex: string;
  eyebrow: string;
  title: string;
  description: string;
  sectionKey: 'projects' | 'characters' | 'world' | 'analytics';
}

export const PlaceholderStudioPage: React.FC<PlaceholderStudioPageProps> = ({
  romanIndex,
  eyebrow,
  title,
  description,
  sectionKey,
}) => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { data, activeProject, getTotalWords } = useInkwell();

  const targetProject =
    data.projects.find((p) => p.id === projectId) ?? activeProject;

  const summaryLine = (() => {
    switch (sectionKey) {
      case 'projects':
        return `${data.projects.length} bound volumes and ${data.chapters.length} chapters catalogued in local storage.`;
      case 'characters':
        return `${data.characters.length} character dossiers already indexed in your study archive.`;
      case 'world':
        return `${data.locations.length} atlas locations, ${data.lore.length} lore records, and ${data.timeline.length} chronological entries stored.`;
      case 'analytics':
        return `${formatWordCount(getTotalWords())} words inked across ${data.sessions.length} recorded writing sessions.`;
    }
  })();

  return (
    <div className="max-w-[920px] mx-auto px-5 sm:px-8 pt-10 sm:pt-14 pb-16">
      <div
        className="relative paper-folio p-8 sm:p-12 md:p-14"
        style={{ transform: 'rotate(-0.3deg)' }}
      >
        <CornerOrnament position="tl" />
        <CornerOrnament position="tr" />
        <CornerOrnament position="bl" />
        <CornerOrnament position="br" />

        <div className="flex items-start justify-between gap-6">
          <div>
            <p
              className="small-caps-meta text-xs"
              style={{ color: 'var(--accent-brass)' }}
            >
              Folio {romanIndex} · {eyebrow}
            </p>
            <h1
              className="font-display text-3xl sm:text-4xl font-medium mt-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </h1>
          </div>
          <WaxSeal monogram={romanIndex} size={50} className="shrink-0 hidden sm:block" />
        </div>

        <FleuronDivider className="my-7" />

        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-8 items-center">
          <div className="space-y-4">
            <p
              className="drop-cap text-lg sm:text-[19px] leading-[1.75]"
              style={{ color: 'var(--text-secondary)' }}
            >
              {description}
            </p>
            <p
              className="text-sm font-mono-tabular pt-2"
              style={{ color: 'var(--text-muted)' }}
            >
              {summaryLine}
            </p>
          </div>
          <div className="flex justify-center">
            <QuillIllustration className="w-40 h-auto opacity-85" />
          </div>
        </div>

        <div
          className="mt-9 pt-6 border-t flex flex-wrap items-center justify-between gap-4"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          <span
            className="text-sm font-manuscript italic"
            style={{ color: 'var(--text-muted)' }}
          >
            Scheduled for the next phase of the Inkwell studio build.
          </span>

          <button
            type="button"
            onClick={() => {
              if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-manuscript transition-colors cursor-pointer"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#F4EFE5',
            }}
            title="Return to previous page"
            aria-label="Go back to previous page"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.4} />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    </div>
  );
};
