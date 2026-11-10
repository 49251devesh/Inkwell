import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, MapPin, Compass, BookOpen, Clock } from 'lucide-react';
import { LoreEntry, Project, TimelineEvent, WorldLocation } from '../../types/inkwell';
import { CornerOrnament, WaxSeal } from '../ornaments/Ornaments';

// ============================================================================
// 1. LOCATION DIALOG
// ============================================================================
interface LocationDialogProps {
  open: boolean;
  onClose: () => void;
  location?: WorldLocation | null;
  projects: Project[];
  activeProjectId: string;
  defaultCoords?: { x: number; y: number } | null;
  onSave: (data: Omit<WorldLocation, 'id'>) => void;
}

export const LocationDialog: React.FC<LocationDialogProps> = ({
  open,
  onClose,
  location,
  projects,
  activeProjectId,
  defaultCoords,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [atmosphere, setAtmosphere] = useState('');
  const [description, setDescription] = useState('');
  const [mapX, setMapX] = useState(50);
  const [mapY, setMapY] = useState(50);
  const [projectId, setProjectId] = useState(activeProjectId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (location) {
      setName(location.name);
      setRegion(location.region);
      setAtmosphere(location.atmosphere);
      setDescription(location.description);
      setMapX(location.mapX);
      setMapY(location.mapY);
      setProjectId(location.projectId);
      setError(null);
    } else {
      setName('');
      setRegion('Northern Provinces');
      setAtmosphere('Damp cedarwood, sea spray, distant church bells');
      setDescription('');
      setMapX(defaultCoords?.x ?? Math.floor(20 + Math.random() * 60));
      setMapY(defaultCoords?.y ?? Math.floor(20 + Math.random() * 60));
      setProjectId(activeProjectId || (projects[0]?.id ?? ''));
      setError(null);
    }
  }, [location, open, activeProjectId, projects, defaultCoords]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Location requires a name.');
      return;
    }
    onSave({
      name: name.trim(),
      region: region.trim() || 'Uncharted Region',
      atmosphere: atmosphere.trim() || 'A quiet sanctuary awaiting narrative ink.',
      description: description.trim() || 'Noted upon the atlas for this volume.',
      mapX: Math.max(5, Math.min(95, Number(mapX) || 50)),
      mapY: Math.max(5, Math.min(95, Number(mapY) || 50)),
      projectId,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scaleY: 0.85, rotateX: -14, y: -20 }}
            animate={{ opacity: 1, scaleY: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, scaleY: 0.88, rotateX: -10, y: -16 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            style={{
              transformOrigin: 'top center',
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-brass)',
              boxShadow: 'var(--shadow-stacked)',
            }}
            className="relative z-10 w-full max-w-xl border p-6 sm:p-8 my-auto"
          >
            <CornerOrnament position="tl" />
            <CornerOrnament position="tr" />
            <CornerOrnament position="bl" />
            <CornerOrnament position="br" />

            <div className="flex items-start justify-between gap-3 pb-4 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
              <div>
                <p className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                  Cartographic Atlas Inscription
                </p>
                <h3 className="font-display text-2xl font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                  {location ? `Revise Location: ${location.name}` : 'Chart New Atlas Location'}
                </h3>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 hover:opacity-75 cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-7">
                  <label htmlFor="loc-name" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Location Name
                  </label>
                  <input
                    id="loc-name"
                    type="text"
                    autoFocus
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="e.g. Aldershot Observatory"
                    className="w-full px-3 py-1.5 text-sm font-manuscript border focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: error ? 'var(--accent-primary)' : 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  {error && <p className="mt-1 text-xs italic text-[var(--accent-primary)]">{error}</p>}
                </div>
                <div className="sm:col-span-5">
                  <label htmlFor="loc-proj" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Volume
                  </label>
                  <select
                    id="loc-proj"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-manuscript border focus:outline-none cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="text-black">
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="loc-region" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Region or Province
                </label>
                <input
                  id="loc-region"
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="e.g. Bloomsbury North, London"
                  className="w-full px-3 py-1.5 text-sm font-manuscript border focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div>
                <label htmlFor="loc-atmosphere" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Atmospheric Sensory Signature
                </label>
                <input
                  id="loc-atmosphere"
                  type="text"
                  value={atmosphere}
                  onChange={(e) => setAtmosphere(e.target.value)}
                  placeholder="e.g. Damp glass, cedarwood shelves, distant rain on ironwork"
                  className="w-full px-3 py-1.5 text-sm font-manuscript border focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div>
                <label htmlFor="loc-desc" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Cartographic Description &amp; Significance
                </label>
                <textarea
                  id="loc-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Physical description, history, or scene events that occur here..."
                  className="w-full px-3 py-1.5 text-sm font-manuscript border resize-none focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label htmlFor="loc-mapx" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Map Coordinate X ({mapX}%)
                  </label>
                  <input
                    id="loc-mapx"
                    type="range"
                    min={5}
                    max={95}
                    value={mapX}
                    onChange={(e) => setMapX(Number(e.target.value))}
                    className="w-full accent-[var(--accent-brass)]"
                  />
                </div>
                <div>
                  <label htmlFor="loc-mapy" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Map Coordinate Y ({mapY}%)
                  </label>
                  <input
                    id="loc-mapy"
                    type="range"
                    min={5}
                    max={95}
                    value={mapY}
                    onChange={(e) => setMapY(Number(e.target.value))}
                    className="w-full accent-[var(--accent-brass)]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--border-hairline)' }}>
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-manuscript italic cursor-pointer hover:opacity-75" style={{ color: 'var(--text-secondary)' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-manuscript tracking-wide cursor-pointer rounded-sm"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#F4EFE5',
                  }}
                >
                  {location ? 'Save Location' : 'Chart on Atlas'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ============================================================================
// 2. LORE RECORD DIALOG
// ============================================================================
interface LoreDialogProps {
  open: boolean;
  onClose: () => void;
  lore?: LoreEntry | null;
  projects: Project[];
  activeProjectId: string;
  onSave: (data: Omit<LoreEntry, 'id'>) => void;
}

export const LoreDialog: React.FC<LoreDialogProps> = ({
  open,
  onClose,
  lore,
  projects,
  activeProjectId,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('History');
  const [summary, setSummary] = useState('');
  const [projectId, setProjectId] = useState(activeProjectId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lore) {
      setTitle(lore.title);
      setCategory(lore.category);
      setSummary(lore.summary);
      setProjectId(lore.projectId);
      setError(null);
    } else {
      setTitle('');
      setCategory('Civic Custom');
      setSummary('');
      setProjectId(activeProjectId || (projects[0]?.id ?? ''));
      setError(null);
    }
  }, [lore, open, activeProjectId, projects]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('A lore record title is required.');
      return;
    }
    if (!summary.trim()) {
      setError('Please provide a summary or historical account.');
      return;
    }
    onSave({
      title: title.trim(),
      category: category.trim() || 'History',
      summary: summary.trim(),
      projectId,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scaleY: 0.85, rotateX: -14, y: -20 }}
            animate={{ opacity: 1, scaleY: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, scaleY: 0.88, rotateX: -10, y: -16 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            style={{
              transformOrigin: 'top center',
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-brass)',
              boxShadow: 'var(--shadow-stacked)',
            }}
            className="relative z-10 w-full max-w-xl border p-6 sm:p-8 my-auto"
          >
            <CornerOrnament position="tl" />
            <CornerOrnament position="tr" />
            <CornerOrnament position="bl" />
            <CornerOrnament position="br" />

            <div className="flex items-start justify-between gap-3 pb-4 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
              <div>
                <p className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                  Chronicle &amp; Lore Record
                </p>
                <h3 className="font-display text-2xl font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                  {lore ? `Revise Lore: ${lore.title}` : 'Inscribe Lore Record'}
                </h3>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 hover:opacity-75 cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-7">
                  <label htmlFor="lore-title" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Title of Custom or Record
                  </label>
                  <input
                    id="lore-title"
                    type="text"
                    autoFocus
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="e.g. The Ordinance of the Fourth Bell"
                    className="w-full px-3 py-1.5 text-sm font-manuscript border focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: error ? 'var(--accent-primary)' : 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  {error && <p className="mt-1 text-xs italic text-[var(--accent-primary)]">{error}</p>}
                </div>

                <div className="sm:col-span-5">
                  <label htmlFor="lore-proj" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Volume
                  </label>
                  <select
                    id="lore-proj"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-manuscript border focus:outline-none cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="text-black">
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="lore-cat" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Category
                </label>
                <select
                  id="lore-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm font-manuscript border focus:outline-none cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="Civic Custom">Civic Custom &amp; Law</option>
                  <option value="Guild Tradition">Guild Tradition &amp; Ciphers</option>
                  <option value="Historical Myth">Historical Myth &amp; Legend</option>
                  <option value="Natural Science & Alchemy">Natural Science &amp; Alchemy</option>
                  <option value="Relics & Artifacts">Relics &amp; Sacred Artifacts</option>
                  <option value="Factions & Factions">Factions &amp; Lineages</option>
                </select>
              </div>

              <div>
                <label htmlFor="lore-summary" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Historical Narrative Account
                </label>
                <textarea
                  id="lore-summary"
                  rows={4}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Record the origin, oral tradition, or historical dispute surrounding this entry..."
                  className="w-full px-3 py-1.5 text-sm font-manuscript border resize-none focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--border-hairline)' }}>
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-manuscript italic cursor-pointer hover:opacity-75" style={{ color: 'var(--text-secondary)' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-manuscript tracking-wide cursor-pointer rounded-sm"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#F4EFE5',
                  }}
                >
                  {lore ? 'Save Record' : 'Inscribe Lore'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ============================================================================
// 3. TIMELINE EVENT DIALOG
// ============================================================================
interface TimelineDialogProps {
  open: boolean;
  onClose: () => void;
  event?: TimelineEvent | null;
  projects: Project[];
  activeProjectId: string;
  nextOrder: number;
  onSave: (data: Omit<TimelineEvent, 'id'>) => void;
}

export const TimelineDialog: React.FC<TimelineDialogProps> = ({
  open,
  onClose,
  event,
  projects,
  activeProjectId,
  nextOrder,
  onSave,
}) => {
  const [era, setEra] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(activeProjectId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      setEra(event.era);
      setTitle(event.title);
      setDescription(event.description);
      setProjectId(event.projectId);
      setError(null);
    } else {
      setEra('Autumn 1842');
      setTitle('');
      setDescription('');
      setProjectId(activeProjectId || (projects[0]?.id ?? ''));
      setError(null);
    }
  }, [event, open, activeProjectId, projects]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Event title is required.');
      return;
    }
    if (!era.trim()) {
      setError('Chronological era or date is required.');
      return;
    }
    onSave({
      era: era.trim(),
      title: title.trim(),
      description: description.trim() || 'A turning point inscribed into the manuscript chronicle.',
      order: event?.order ?? nextOrder,
      projectId,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scaleY: 0.85, rotateX: -14, y: -20 }}
            animate={{ opacity: 1, scaleY: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, scaleY: 0.88, rotateX: -10, y: -16 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            style={{
              transformOrigin: 'top center',
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-brass)',
              boxShadow: 'var(--shadow-stacked)',
            }}
            className="relative z-10 w-full max-w-xl border p-6 sm:p-8 my-auto"
          >
            <CornerOrnament position="tl" />
            <CornerOrnament position="tr" />
            <CornerOrnament position="bl" />
            <CornerOrnament position="br" />

            <div className="flex items-start justify-between gap-3 pb-4 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
              <div>
                <p className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                  Chronicle Timeline Milestone
                </p>
                <h3 className="font-display text-2xl font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                  {event ? `Revise Event: ${event.title}` : 'Inscribe Turning Point'}
                </h3>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 hover:opacity-75 cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-7">
                  <label htmlFor="tl-era" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Chronological Era / Date
                  </label>
                  <input
                    id="tl-era"
                    type="text"
                    autoFocus
                    value={era}
                    onChange={(e) => setEra(e.target.value)}
                    placeholder="e.g. November 1889, or Year 304 of the Second Foundry"
                    className="w-full px-3 py-1.5 text-sm font-manuscript border focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div className="sm:col-span-5">
                  <label htmlFor="tl-proj" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Volume
                  </label>
                  <select
                    id="tl-proj"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-manuscript border focus:outline-none cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="text-black">
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="tl-title" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Turning Point Title
                </label>
                <input
                  id="tl-title"
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. The Discovery in the Third Gallery"
                  className="w-full px-3 py-1.5 text-sm font-manuscript border focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: error ? 'var(--accent-primary)' : 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                />
                {error && <p className="mt-1 text-xs italic text-[var(--accent-primary)]">{error}</p>}
              </div>

              <div>
                <label htmlFor="tl-desc" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Narrative Turning Point Description
                </label>
                <textarea
                  id="tl-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What occurred, who was present, and how does this shift the trajectory of the plot?"
                  className="w-full px-3 py-1.5 text-sm font-manuscript border resize-none focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--border-hairline)' }}>
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-manuscript italic cursor-pointer hover:opacity-75" style={{ color: 'var(--text-secondary)' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-manuscript tracking-wide cursor-pointer rounded-sm"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#F4EFE5',
                  }}
                >
                  {event ? 'Save Turning Point' : 'Inscribe Milestone'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
