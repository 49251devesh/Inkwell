import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Compass,
  MapPin,
  Pencil,
  Plus,
  Scroll,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useInkwell } from '../store/inkwellStore';
import { useToast } from '../hooks/useToast';
import { LoreEntry, Project, TimelineEvent, WorldLocation } from '../types/inkwell';
import { CornerOrnament, FleuronDivider, WaxSeal } from '../components/ornaments/Ornaments';
import {
  LocationDialog,
  LoreDialog,
  TimelineDialog,
} from '../components/world/WorldBuilderDialogs';
import { UnfoldingPaperDialog } from '../components/common/UnfoldingPaperDialog';
import {
  EmptyAtlasIllustration,
  EmptyChronicleIllustration,
} from '../components/common/EmptyStateIllustrations';


export const WorldBuilderPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    data,
    activeProject,
    createLocation,
    updateLocation,
    deleteLocation,
    createLore,
    updateLore,
    deleteLore,
    createTimelineEvent,
    updateTimelineEvent,
    deleteTimelineEvent,
    reorderTimeline,
  } = useInkwell();
  const { notify } = useToast();

  // Active section view mode: Atlas Map vs Lore Compendium vs Timeline
  const [activeTab, setActiveTab] = useState<'atlas' | 'lore' | 'timeline'>('atlas');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>(
    activeProject?.id ?? 'all'
  );

  // Map of project titles
  const projectMap = useMemo(() => new Map(data.projects.map((p) => [p.id, p])), [data.projects]);

  // ============================================================================
  // ATLAS / LOCATION STATE
  // ============================================================================
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [locationToEdit, setLocationToEdit] = useState<WorldLocation | null>(null);
  const [locationToDelete, setLocationToDelete] = useState<WorldLocation | null>(null);
  const [mapClickCoords, setMapClickCoords] = useState<{ x: number; y: number } | null>(null);

  const filteredLocations = useMemo(() => {
    return data.locations.filter((loc) => {
      if (selectedProjectFilter !== 'all' && loc.projectId !== selectedProjectFilter) return false;
      return true;
    });
  }, [data.locations, selectedProjectFilter]);

  const selectedLocation = useMemo(() => {
    if (!selectedLocationId) return filteredLocations[0] ?? data.locations[0] ?? null;
    return data.locations.find((l) => l.id === selectedLocationId) ?? filteredLocations[0] ?? null;
  }, [selectedLocationId, data.locations, filteredLocations]);

  // ============================================================================
  // LORE STATE
  // ============================================================================
  const [selectedLoreId, setSelectedLoreId] = useState<string | null>(null);
  const [loreCategoryFilter, setLoreCategoryFilter] = useState<string>('all');
  const [loreSearchQuery, setLoreSearchQuery] = useState('');
  const [isLoreDialogOpen, setIsLoreDialogOpen] = useState(false);
  const [loreToEdit, setLoreToEdit] = useState<LoreEntry | null>(null);
  const [loreToDelete, setLoreToDelete] = useState<LoreEntry | null>(null);

  const filteredLore = useMemo(() => {
    return data.lore.filter((item) => {
      if (selectedProjectFilter !== 'all' && item.projectId !== selectedProjectFilter) return false;
      if (loreCategoryFilter !== 'all' && item.category !== loreCategoryFilter) return false;
      if (loreSearchQuery.trim()) {
        const q = loreSearchQuery.toLowerCase().trim();
        return item.title.toLowerCase().includes(q) || item.summary.toLowerCase().includes(q);
      }
      return true;
    });
  }, [data.lore, selectedProjectFilter, loreCategoryFilter, loreSearchQuery]);

  const selectedLore = useMemo(() => {
    if (!selectedLoreId) return filteredLore[0] ?? data.lore[0] ?? null;
    return data.lore.find((l) => l.id === selectedLoreId) ?? filteredLore[0] ?? null;
  }, [selectedLoreId, data.lore, filteredLore]);

  // ============================================================================
  // TIMELINE STATE
  // ============================================================================
  const [isTimelineDialogOpen, setIsTimelineDialogOpen] = useState(false);
  const [timelineToEdit, setTimelineToEdit] = useState<TimelineEvent | null>(null);
  const [timelineToDelete, setTimelineToDelete] = useState<TimelineEvent | null>(null);

  const filteredTimeline = useMemo(() => {
    return data.timeline
      .filter((tl) => {
        if (selectedProjectFilter !== 'all' && tl.projectId !== selectedProjectFilter) return false;
        return true;
      })
      .sort((a, b) => a.order - b.order);
  }, [data.timeline, selectedProjectFilter]);

  // Location Handlers
  const handleSaveLocation = (input: Omit<WorldLocation, 'id'>) => {
    if (locationToEdit) {
      updateLocation(locationToEdit.id, input);
      notify('Location Revised', `“${input.name}” atlas entry updated.`);
      setLocationToEdit(null);
    } else {
      const created = createLocation(input);
      notify('Location Charted', `“${created.name}” plotted upon the atlas.`);
      setSelectedLocationId(created.id);
    }
    setMapClickCoords(null);
  };

  const handleConfirmDeleteLocation = () => {
    if (!locationToDelete) return;
    const name = locationToDelete.name;
    deleteLocation(locationToDelete.id);
    notify('Location Expunged', `“${name}” struck from the atlas.`);
    if (selectedLocationId === locationToDelete.id) setSelectedLocationId(null);
    setLocationToDelete(null);
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setMapClickCoords({ x, y });
    setLocationToEdit(null);
    setIsLocationDialogOpen(true);
  };

  // Lore Handlers
  const handleSaveLore = (input: Omit<LoreEntry, 'id'>) => {
    if (loreToEdit) {
      updateLore(loreToEdit.id, input);
      notify('Lore Revised', `“${input.title}” chronicle updated.`);
      setLoreToEdit(null);
    } else {
      const created = createLore(input);
      notify('Lore Inscribed', `“${created.title}” recorded in study archives.`);
      setSelectedLoreId(created.id);
    }
  };

  const handleConfirmDeleteLore = () => {
    if (!loreToDelete) return;
    const title = loreToDelete.title;
    deleteLore(loreToDelete.id);
    notify('Lore Struck', `“${title}” struck from chronicle.`);
    if (selectedLoreId === loreToDelete.id) setSelectedLoreId(null);
    setLoreToDelete(null);
  };

  // Timeline Handlers
  const handleSaveTimeline = (input: Omit<TimelineEvent, 'id'>) => {
    if (timelineToEdit) {
      updateTimelineEvent(timelineToEdit.id, input);
      notify('Milestone Revised', `“${input.title}” chronicle entry updated.`);
      setTimelineToEdit(null);
    } else {
      const created = createTimelineEvent(input);
      notify('Milestone Inscribed', `“${created.title}” bound to timeline.`);
    }
  };

  const handleMoveTimeline = (id: string, direction: 'up' | 'down') => {
    const currentOrder = filteredTimeline.map((t) => t.id);
    const index = currentOrder.indexOf(id);
    if (index === -1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= currentOrder.length) return;

    const newOrder = [...currentOrder];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIdx, 0, moved);

    const targetProject = selectedProjectFilter !== 'all' ? selectedProjectFilter : (activeProject?.id ?? '');
    if (targetProject) {
      reorderTimeline(targetProject, newOrder);
      notify('Chronology Shifted', 'Milestone order updated.');
    }
  };

  const handleConfirmDeleteTimeline = () => {
    if (!timelineToDelete) return;
    const title = timelineToDelete.title;
    deleteTimelineEvent(timelineToDelete.id);
    notify('Milestone Struck', `“${title}” expunged from chronicle.`);
    setTimelineToDelete(null);
  };

  return (
    <div className="max-w-[1260px] mx-auto px-5 sm:px-8 lg:px-12 pt-8 sm:pt-12 pb-24">
      {/* =====================================================================
          1. MASTHEAD & WORLD ARCHIVE OVERVIEW
         ===================================================================== */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-end justify-between gap-6 pb-8 border-b"
        style={{ borderColor: 'var(--border-hairline)' }}
      >
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
                  navigate(-1);
                } else {
                  navigate('/');
                }
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-manuscript rounded border transition-colors hover:bg-[var(--burgundy-wash)] cursor-pointer"
              style={{
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-secondary)',
              }}
              title="Return to previous page"
              aria-label="Go back to previous page"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.4} />
              <span>Back</span>
            </button>
            <span aria-hidden="true" style={{ color: 'var(--border-hairline)' }}>·</span>
            <p className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
              Folio V · Atlas &amp; Chronicle
            </p>
          </div>

          <h1
            className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            World Builder
          </h1>

          <div
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm pt-1"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="font-mono-tabular">{data.locations.length} atlas locations</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{data.lore.length} lore records</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{data.timeline.length} turning points charted</span>
          </div>
        </div>

        {/* Primary Action depending on active tab */}
        <div>
          {activeTab === 'atlas' && (
            <button
              type="button"
              onClick={() => {
                setLocationToEdit(null);
                setMapClickCoords(null);
                setIsLocationDialogOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-manuscript cursor-pointer transition-opacity hover:opacity-95 whitespace-nowrap shadow-sm"
              style={{ backgroundColor: 'var(--accent-primary)', color: '#F4EFE5' }}
            >
              <MapPin className="w-4 h-4" strokeWidth={1.4} />
              <span>Chart New Location</span>
            </button>
          )}

          {activeTab === 'lore' && (
            <button
              type="button"
              onClick={() => {
                setLoreToEdit(null);
                setIsLoreDialogOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-manuscript cursor-pointer transition-opacity hover:opacity-95 whitespace-nowrap shadow-sm"
              style={{ backgroundColor: 'var(--accent-primary)', color: '#F4EFE5' }}
            >
              <BookOpen className="w-4 h-4" strokeWidth={1.4} />
              <span>Inscribe Lore Record</span>
            </button>
          )}

          {activeTab === 'timeline' && (
            <button
              type="button"
              onClick={() => {
                setTimelineToEdit(null);
                setIsTimelineDialogOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-manuscript cursor-pointer transition-opacity hover:opacity-95 whitespace-nowrap shadow-sm"
              style={{ backgroundColor: 'var(--accent-primary)', color: '#F4EFE5' }}
            >
              <Scroll className="w-4 h-4" strokeWidth={1.4} />
              <span>Inscribe Turning Point</span>
            </button>
          )}
        </div>
      </motion.section>

      {/* =====================================================================
          2. NAVIGATIONAL ARCHITECTURE: 3-VIEW SWITCHER & VOLUME SELECTOR
         ===================================================================== */}
      <section className="mt-8 flex flex-wrap items-center justify-between gap-4">
        {/* Tri-View Switcher Tabs */}
        <div
          className="flex items-center gap-1 p-1 border rounded-sm"
          style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--bg-surface)' }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('atlas')}
            className={`px-4 py-1.5 text-xs sm:text-sm font-manuscript rounded-xs transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'atlas'
                ? 'bg-[var(--accent-primary)] text-[#F4EFE5] font-medium'
                : 'text-[var(--text-secondary)] hover:bg-[var(--burgundy-wash)]'
            }`}
          >
            <Compass className="w-4 h-4" strokeWidth={1.4} />
            <span>Cartographic Atlas ({filteredLocations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lore')}
            className={`px-4 py-1.5 text-xs sm:text-sm font-manuscript rounded-xs transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'lore'
                ? 'bg-[var(--accent-primary)] text-[#F4EFE5] font-medium'
                : 'text-[var(--text-secondary)] hover:bg-[var(--burgundy-wash)]'
            }`}
          >
            <BookOpen className="w-4 h-4" strokeWidth={1.4} />
            <span>Lore Compendium ({filteredLore.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-1.5 text-xs sm:text-sm font-manuscript rounded-xs transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'timeline'
                ? 'bg-[var(--accent-primary)] text-[#F4EFE5] font-medium'
                : 'text-[var(--text-secondary)] hover:bg-[var(--burgundy-wash)]'
            }`}
          >
            <Scroll className="w-4 h-4" strokeWidth={1.4} />
            <span>Illuminated Timeline ({filteredTimeline.length})</span>
          </button>
        </div>

        {/* Volume Scope Filter */}
        <div className="flex items-center gap-2">
          <span className="small-caps-meta text-xs" style={{ color: 'var(--text-muted)' }}>
            Volume Scope:
          </span>
          <select
            value={selectedProjectFilter}
            onChange={(e) => setSelectedProjectFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-manuscript border focus:outline-none cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-brass)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="all">All Manuscript Volumes</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* =====================================================================
          3. VIEW 1: CARTOGRAPHIC ATLAS MAP & LOCATIONS
         ===================================================================== */}
      {activeTab === 'atlas' && (
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (7 cols): Hand-drawn Interactive Map Board */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-baseline justify-between text-xs font-manuscript px-1" style={{ color: 'var(--text-muted)' }}>
              <span>Click map pin to inspect · Click anywhere on uncharted parchment to plot new location</span>
              <span className="font-mono-tabular">Coords: 0°–100°</span>
            </div>

            <div
              onClick={handleMapClick}
              className="relative w-full aspect-[4/3] rounded-sm border p-4 cursor-crosshair overflow-hidden select-none"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-brass)',
                boxShadow: 'var(--shadow-paper)',
                backgroundImage: `
                  radial-gradient(ellipse at 50% 50%, rgba(177, 138, 90, 0.08) 0%, transparent 80%),
                  repeating-linear-gradient(0deg, var(--border-hairline) 0px, transparent 1px, transparent 40px),
                  repeating-linear-gradient(90deg, var(--border-hairline) 0px, transparent 1px, transparent 40px)
                `,
              }}
            >
              {/* Antique Map Border Double Rule */}
              <div
                aria-hidden="true"
                className="absolute inset-2 border pointer-events-none"
                style={{ borderColor: 'var(--border-brass)', opacity: 0.5 }}
              />

              {/* Vintage Compass Rose in Corner */}
              <div className="absolute top-4 right-4 pointer-events-none opacity-45">
                <svg viewBox="0 0 100 100" className="w-16 h-16" fill="none" stroke="var(--accent-brass)">
                  <circle cx="50" cy="50" r="45" strokeWidth="0.8" />
                  <circle cx="50" cy="50" r="30" strokeWidth="0.5" strokeDasharray="2,2" />
                  <polygon points="50,10 54,46 50,42 46,46" fill="var(--accent-primary)" />
                  <polygon points="50,90 54,54 50,58 46,54" fill="var(--accent-brass)" />
                  <polygon points="90,50 54,54 58,50 54,46" fill="var(--accent-brass)" />
                  <polygon points="10,50 46,54 42,50 46,46" fill="var(--accent-brass)" />
                  <text x="50" y="8" fontSize="8" textAnchor="middle" fill="var(--text-primary)" fontFamily="serif">N</text>
                  <text x="50" y="98" fontSize="8" textAnchor="middle" fill="var(--text-muted)" fontFamily="serif">S</text>
                  <text x="96" y="53" fontSize="8" textAnchor="middle" fill="var(--text-muted)" fontFamily="serif">E</text>
                  <text x="4" y="53" fontSize="8" textAnchor="middle" fill="var(--text-muted)" fontFamily="serif">W</text>
                </svg>
              </div>

              {/* Cartographic Title Stamp */}
              <div className="absolute bottom-4 left-4 pointer-events-none z-10 bg-[var(--bg-surface)]/85 px-3 py-1.5 border rounded-xs" style={{ borderColor: 'var(--border-hairline)' }}>
                <p className="small-caps-meta text-[10px]" style={{ color: 'var(--accent-brass)' }}>
                  Cartographic Projection · {projectMap.get(selectedProjectFilter)?.title ?? 'Archival Atlas'}
                </p>
                <p className="font-display text-xs italic" style={{ color: 'var(--text-muted)' }}>
                  Surveyed &amp; Charted in London &amp; Lisbon
                </p>
              </div>

              {/* Plotted Location Brass Markers */}
              {filteredLocations.map((loc) => {
                const isSelected = selectedLocation?.id === loc.id;

                return (
                  <div
                    key={loc.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLocationId(loc.id);
                    }}
                    style={{ left: `${loc.mapX}%`, top: `${loc.mapY}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group z-20 cursor-pointer"
                  >
                    {/* Pulsing ring on selected */}
                    {isSelected && (
                      <span
                        className="absolute inset-0 -m-2 rounded-full animate-ping opacity-35"
                        style={{ backgroundColor: 'var(--accent-primary)' }}
                      />
                    )}

                    {/* Brass Pin Node */}
                    <div
                      className={`relative w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 shadow-md ${
                        isSelected
                          ? 'scale-125 ring-2 ring-[var(--accent-brass)]'
                          : 'group-hover:scale-110'
                      }`}
                      style={{
                        backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                        color: isSelected ? '#F4EFE5' : 'var(--accent-brass)',
                        border: '1.5px solid var(--border-brass)',
                      }}
                    >
                      <MapPin className="w-3.5 h-3.5" strokeWidth={1.6} />
                    </div>

                    {/* Label Callout Tag */}
                    <span
                      className={`absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2 py-0.5 text-[11px] font-manuscript rounded whitespace-nowrap pointer-events-none shadow-sm transition-all ${
                        isSelected
                          ? 'bg-[var(--accent-primary)] text-[#F4EFE5] font-medium'
                          : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border opacity-80 group-hover:opacity-100'
                      }`}
                      style={{ borderColor: 'var(--border-hairline)' }}
                    >
                      {loc.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column (5 cols): Selected Location Dossier & Locations List */}
          <div className="lg:col-span-5 space-y-5">
            {selectedLocation ? (
              <div
                className="relative paper-folio p-6 sm:p-7 space-y-4"
                style={{ transform: 'rotate(0.3deg)' }}
              >
                <CornerOrnament position="tl" />
                <CornerOrnament position="tr" />
                <CornerOrnament position="bl" />
                <CornerOrnament position="br" />

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                      Atlas Dossier · {selectedLocation.region}
                    </span>
                    <h3 className="font-display text-2xl font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                      {selectedLocation.name}
                    </h3>
                  </div>
                  <div className="font-mono-tabular text-xs px-2 py-1 rounded border" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}>
                    {selectedLocation.mapX}°N / {selectedLocation.mapY}°W
                  </div>
                </div>

                <FleuronDivider symbol="✦" />

                {/* Atmosphere Quote */}
                <div>
                  <span className="small-caps-meta text-xs block mb-1" style={{ color: 'var(--accent-brass)' }}>
                    Sensory Atmosphere:
                  </span>
                  <p className="italic text-base" style={{ color: 'var(--text-primary)' }}>
                    “{selectedLocation.atmosphere}”
                  </p>
                </div>

                {/* Description */}
                <div>
                  <span className="small-caps-meta text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
                    Topographical Narrative Record:
                  </span>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {selectedLocation.description}
                  </p>
                </div>

                {/* Volume attribution */}
                <div className="pt-2 border-t text-xs font-manuscript" style={{ borderColor: 'var(--border-hairline)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Volume: </span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {projectMap.get(selectedLocation.projectId)?.title ?? 'General Archive'}
                  </span>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--border-hairline)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setLocationToEdit(selectedLocation);
                      setIsLocationDialogOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-manuscript border cursor-pointer hover:bg-[var(--burgundy-wash)]"
                    style={{ borderColor: 'var(--border-brass)', color: 'var(--text-primary)' }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Location</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLocationToDelete(selectedLocation)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-manuscript text-rose-700 hover:text-rose-900 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Strike Location</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="paper-card p-6 text-center italic text-sm" style={{ color: 'var(--text-muted)' }}>
                Select a location marker or click upon the map to plot a new one.
              </div>
            )}

            {/* List of Charted Locations */}
            <div className="paper-card p-5">
              <span className="small-caps-meta text-xs block mb-3" style={{ color: 'var(--accent-brass)' }}>
                Charted Locations ({filteredLocations.length})
              </span>
              {filteredLocations.length > 0 ? (
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {filteredLocations.map((loc) => {
                    const isSelected = selectedLocation?.id === loc.id;
                    return (
                      <div
                        key={loc.id}
                        onClick={() => setSelectedLocationId(loc.id)}
                        className={`p-2.5 rounded-xs border text-left cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'border-[var(--accent-brass)] bg-[var(--burgundy-wash)]'
                            : 'border-transparent hover:bg-[var(--burgundy-wash)]/40'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-manuscript text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {loc.name}
                          </p>
                          <p className="text-xs italic truncate" style={{ color: 'var(--text-muted)' }}>
                            {loc.region}
                          </p>
                        </div>
                        <span className="font-mono-tabular text-xs shrink-0" style={{ color: 'var(--accent-brass)' }}>
                          {loc.mapX}°, {loc.mapY}°
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
                  <EmptyAtlasIllustration className="w-48 h-32" />
                  <p className="font-display italic text-sm" style={{ color: 'var(--text-secondary)' }}>
                    No landmarks charted yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLocationToEdit(null);
                      setMapClickCoords({ x: 50, y: 50 });
                      setIsLocationDialogOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-manuscript cursor-pointer mt-1"
                    style={{ backgroundColor: 'var(--accent-primary)', color: '#F4EFE5' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Plot Landmark</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          4. VIEW 2: LORE COMPENDIUM
         ===================================================================== */}
      {activeTab === 'lore' && (
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (5 cols): Lore Index & Category Filter */}
          <div className="lg:col-span-5 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={loreSearchQuery}
                onChange={(e) => setLoreSearchQuery(e.target.value)}
                placeholder="Search lore by title or narrative text…"
                className="w-full pl-9 pr-4 py-2 text-sm font-manuscript border focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-hairline)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-manuscript">
              {['all', 'Civic Custom', 'Guild Tradition', 'Historical Myth', 'Natural Science & Alchemy'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setLoreCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-xs border transition-colors cursor-pointer ${
                    loreCategoryFilter === cat
                      ? 'bg-[var(--accent-primary)] text-[#F4EFE5] border-[var(--accent-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--burgundy-wash)]'
                  }`}
                >
                  {cat === 'all' ? 'All Lore' : cat}
                </button>
              ))}
            </div>

            {/* Lore Scrolls List */}
            {filteredLore.length > 0 ? (
              <div className="space-y-2">
                {filteredLore.map((item) => {
                  const isSelected = selectedLore?.id === item.id;
                  return (
                    <article
                      key={item.id}
                      onClick={() => setSelectedLoreId(item.id)}
                      className={`p-4 rounded-sm border cursor-pointer transition-all text-left ${
                        isSelected
                          ? 'border-[var(--accent-brass)] bg-[var(--bg-surface)] shadow-sm'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]/70 hover:bg-[var(--burgundy-wash)]/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="small-caps-meta text-[11px]" style={{ color: 'var(--accent-brass)' }}>
                            {item.category}
                          </span>
                          <h4 className="font-display text-base font-medium leading-snug mt-0.5" style={{ color: 'var(--text-primary)' }}>
                            {item.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              setLoreToEdit(item);
                              setIsLoreDialogOpen(true);
                            }}
                            className="p-1 rounded hover:bg-[var(--burgundy-wash)] cursor-pointer"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLoreToDelete(item)}
                            className="p-1 rounded hover:text-rose-600 cursor-pointer"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                        {item.summary}
                      </p>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="paper-folio p-8 flex flex-col items-center justify-center text-center space-y-3">
                <EmptyChronicleIllustration className="w-52 h-36" />
                <p className="font-display italic text-base" style={{ color: 'var(--text-secondary)' }}>
                  No chronicle records match your query.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setLoreToEdit(null);
                    setIsLoreDialogOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-manuscript cursor-pointer mt-1"
                  style={{ backgroundColor: 'var(--accent-primary)', color: '#F4EFE5' }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Inscribe Lore Record</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Column (7 cols): Selected Illuminated Lore Parchment */}
          <div className="lg:col-span-7">
            {selectedLore ? (
              <div
                className="relative paper-folio p-7 sm:p-10 space-y-5"
                style={{ transform: 'rotate(-0.25deg)' }}
              >
                <CornerOrnament position="tl" />
                <CornerOrnament position="tr" />
                <CornerOrnament position="bl" />
                <CornerOrnament position="br" />

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                      Chronicle Record · {selectedLore.category}
                    </span>
                    <h3 className="font-display text-2xl sm:text-3xl font-medium mt-1 leading-tight text-balance" style={{ color: 'var(--text-primary)' }}>
                      {selectedLore.title}
                    </h3>
                  </div>
                  <WaxSeal monogram="📜" size={46} className="shrink-0" />
                </div>

                <FleuronDivider symbol="❦" />

                {/* Narrative prose with editorial drop cap */}
                <div className="py-2">
                  <p className="drop-cap text-lg sm:text-[19px] leading-[1.8] max-w-[62ch]" style={{ color: 'var(--text-primary)' }}>
                    {selectedLore.summary}
                  </p>
                </div>

                <div className="pt-4 border-t flex items-center justify-between text-xs font-manuscript" style={{ borderColor: 'var(--border-hairline)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Bound Volume: {projectMap.get(selectedLore.projectId)?.title ?? 'General Lore'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setLoreToEdit(selectedLore);
                      setIsLoreDialogOpen(true);
                    }}
                    className="text-xs font-manuscript italic underline underline-offset-4 cursor-pointer hover:opacity-80"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    Revise Inscription
                  </button>
                </div>
              </div>
            ) : (
              <div className="paper-folio p-12 text-center italic text-base" style={{ color: 'var(--text-muted)' }}>
                Select a lore record from the compendium to read its chronicle folio.
              </div>
            )}
          </div>
        </section>
      )}

      {/* =====================================================================
          5. VIEW 3: ILLUMINATED VERTICAL TIMELINE
         ===================================================================== */}
      {activeTab === 'timeline' && (
        <section className="mt-10 relative max-w-4xl mx-auto">
          {/* Central Vertical Axis Line */}
          {filteredTimeline.length > 0 && (
            <div
              aria-hidden="true"
              className="absolute left-6 md:left-1/2 top-4 bottom-8 w-px -translate-x-1/2 pointer-events-none"
              style={{
                background: 'linear-gradient(180deg, var(--border-brass) 0%, var(--accent-brass) 50%, var(--border-hairline) 100%)',
              }}
            />
          )}

          {filteredTimeline.length > 0 ? (
            <div className="space-y-10 relative">
              {filteredTimeline.map((tl, idx) => {
                const isEven = idx % 2 === 0;

                return (
                  <div
                    key={tl.id}
                    className={`relative flex flex-col md:flex-row items-start ${
                      isEven ? 'md:flex-row-reverse' : ''
                    }`}
                  >
                    {/* Central Node Wax Stamp */}
                    <div
                      className="absolute left-6 md:left-1/2 -translate-x-1/2 top-3 z-10 w-8 h-8 rounded-full border shadow-md flex items-center justify-center"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--accent-brass)',
                        color: 'var(--accent-primary)',
                      }}
                    >
                      <span className="font-mono-tabular text-xs font-medium">{idx + 1}</span>
                    </div>

                    {/* Spacer for other side */}
                    <div className="hidden md:block w-1/2" />

                    {/* Milestone Card */}
                    <div className={`w-full md:w-1/2 pl-12 md:pl-0 ${isEven ? 'md:pr-10' : 'md:pl-10'}`}>
                      <div
                        className="paper-card p-5 sm:p-6 relative group transition-transform duration-200 hover:-translate-y-1"
                        style={{ transform: isEven ? 'rotate(0.3deg)' : 'rotate(-0.3deg)' }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                              {tl.era}
                            </span>
                            <h4 className="font-display text-lg sm:text-xl font-medium mt-0.5 leading-snug" style={{ color: 'var(--text-primary)' }}>
                              {tl.title}
                            </h4>
                          </div>

                          {/* Order Steppers & Edit/Delete */}
                          <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveTimeline(tl.id, 'up')}
                                title="Move Earlier"
                                className="p-0.5 hover:text-[var(--accent-primary)] disabled:opacity-20 cursor-pointer disabled:pointer-events-none"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === filteredTimeline.length - 1}
                                onClick={() => handleMoveTimeline(tl.id, 'down')}
                                title="Move Later"
                                className="p-0.5 hover:text-[var(--accent-primary)] disabled:opacity-20 cursor-pointer disabled:pointer-events-none"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setTimelineToEdit(tl);
                                setIsTimelineDialogOpen(true);
                              }}
                              className="p-1 rounded hover:bg-[var(--burgundy-wash)] cursor-pointer"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setTimelineToDelete(tl)}
                              className="p-1 rounded hover:text-rose-600 cursor-pointer"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className="mt-3 text-sm sm:text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {tl.description}
                        </p>

                        <div className="mt-4 pt-2.5 border-t text-xs font-manuscript" style={{ borderColor: 'var(--border-hairline)' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Chronicle of: </span>
                          <span className="italic" style={{ color: 'var(--text-primary)' }}>
                            {projectMap.get(tl.projectId)?.title ?? 'Manuscript Timeline'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="paper-folio max-w-xl mx-auto p-10 flex flex-col items-center justify-center text-center space-y-3 relative z-10">
              <EmptyChronicleIllustration className="w-56 h-36" />
              <h3 className="font-display text-xl font-medium" style={{ color: 'var(--text-primary)' }}>
                The Historical Scroll Remains Unwritten
              </h3>
              <p className="text-sm max-w-sm" style={{ color: 'var(--text-secondary)' }}>
                Inscribe the eras, pivotal encounters, and historic milestones that anchor your narrative.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTimelineToEdit(null);
                  setIsTimelineDialogOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-manuscript cursor-pointer transition-opacity hover:opacity-90 mt-2"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#F4EFE5',
                }}
              >
                <Plus className="w-4 h-4" />
                <span>Inscribe Opening Epoch</span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          6. MODALS & CONFIRMATION DECREES
         ===================================================================== */}
      {/* Location Dialog */}
      <LocationDialog
        open={isLocationDialogOpen}
        onClose={() => {
          setIsLocationDialogOpen(false);
          setLocationToEdit(null);
          setMapClickCoords(null);
        }}
        location={locationToEdit}
        projects={data.projects}
        activeProjectId={selectedProjectFilter !== 'all' ? selectedProjectFilter : (activeProject?.id ?? '')}
        defaultCoords={mapClickCoords}
        onSave={handleSaveLocation}
      />

      {/* Lore Dialog */}
      <LoreDialog
        open={isLoreDialogOpen}
        onClose={() => {
          setIsLoreDialogOpen(false);
          setLoreToEdit(null);
        }}
        lore={loreToEdit}
        projects={data.projects}
        activeProjectId={selectedProjectFilter !== 'all' ? selectedProjectFilter : (activeProject?.id ?? '')}
        onSave={handleSaveLore}
      />

      {/* Timeline Dialog */}
      <TimelineDialog
        open={isTimelineDialogOpen}
        onClose={() => {
          setIsTimelineDialogOpen(false);
          setTimelineToEdit(null);
        }}
        event={timelineToEdit}
        projects={data.projects}
        activeProjectId={selectedProjectFilter !== 'all' ? selectedProjectFilter : (activeProject?.id ?? '')}
        nextOrder={filteredTimeline.length + 1}
        onSave={handleSaveTimeline}
      />

      {/* Delete Location Confirmation Decree */}
      <UnfoldingPaperDialog
        open={Boolean(locationToDelete)}
        onClose={() => setLocationToDelete(null)}
        onConfirm={handleConfirmDeleteLocation}
        eyebrow="Atlas Decree · Expunging Geography"
        title={locationToDelete ? `Expunge “${locationToDelete.name}” from Atlas?` : ''}
        confirmLabel="Strike from Atlas"
        cancelLabel="Preserve Location"
        isDestructive={true}
        description={
          locationToDelete && (
            <p>
              Are you certain you wish to strike{' '}
              <strong className="text-[var(--text-primary)] font-medium">“{locationToDelete.name}”</strong> from
              the cartographic survey? Its coordinates and atmospheric notes will be expunged from this volume.
            </p>
          )
        }
      />

      {/* Delete Lore Confirmation Decree */}
      <UnfoldingPaperDialog
        open={Boolean(loreToDelete)}
        onClose={() => setLoreToDelete(null)}
        onConfirm={handleConfirmDeleteLore}
        eyebrow="Lore Decree · Striking Chronicle"
        title={loreToDelete ? `Strike “${loreToDelete.title}” from Chronicle?` : ''}
        confirmLabel="Strike Record"
        cancelLabel="Preserve Record"
        isDestructive={true}
        description={
          loreToDelete && (
            <p>
              Are you certain you wish to expunge{' '}
              <strong className="text-[var(--text-primary)] font-medium">“{loreToDelete.title}”</strong> from
              your worldbuilding archives?
            </p>
          )
        }
      />

      {/* Delete Timeline Event Confirmation Decree */}
      <UnfoldingPaperDialog
        open={Boolean(timelineToDelete)}
        onClose={() => setTimelineToDelete(null)}
        onConfirm={handleConfirmDeleteTimeline}
        eyebrow="Chronicle Decree · Striking Milestone"
        title={timelineToDelete ? `Strike “${timelineToDelete.title}” from Timeline?` : ''}
        confirmLabel="Strike Milestone"
        cancelLabel="Preserve Milestone"
        isDestructive={true}
        description={
          timelineToDelete && (
            <p>
              Are you certain you wish to strike{' '}
              <strong className="text-[var(--text-primary)] font-medium">“{timelineToDelete.title}”</strong> from
              the chronological turning points of this novel?
            </p>
          )
        }
      />
    </div>
  );
};
