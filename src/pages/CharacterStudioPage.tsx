import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Filter,
  Network,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useInkwell } from '../store/inkwellStore';
import { useToast } from '../hooks/useToast';
import { Character } from '../types/inkwell';
import { CornerOrnament, FleuronDivider, WaxSeal } from '../components/ornaments/Ornaments';
import { CharacterDossierDialog } from '../components/characters/CharacterDossierDialog';
import { CharacterNetworkGraph } from '../components/characters/CharacterNetworkGraph';
import { UnfoldingPaperDialog } from '../components/common/UnfoldingPaperDialog';
import { EmptyCastIllustration } from '../components/common/EmptyStateIllustrations';


export const CharacterStudioPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, activeProject, createCharacter, updateCharacter, deleteCharacter } = useInkwell();
  const { notify } = useToast();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>(
    activeProject?.id ?? 'all'
  );
  const [viewMode, setViewMode] = useState<'cards' | 'matrix'>('cards');
  const [networkSubMode, setNetworkSubMode] = useState<'graph' | 'ledger'>('graph');

  // Selected character for inspection
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [characterToEdit, setCharacterToEdit] = useState<Character | null>(null);
  const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null);

  // Map of project titles for quick lookup
  const projectMap = useMemo(() => {
    return new Map(data.projects.map((p) => [p.id, p]));
  }, [data.projects]);

  // Filtered characters
  const filteredCharacters = useMemo(() => {
    return data.characters.filter((char) => {
      // Project filter
      if (selectedProjectFilter !== 'all' && char.projectId !== selectedProjectFilter) {
        return false;
      }
      // Role filter
      if (selectedRoleFilter !== 'all') {
        const roleLower = char.role.toLowerCase();
        if (selectedRoleFilter === 'protagonist' && !roleLower.includes('protagonist')) return false;
        if (selectedRoleFilter === 'antagonist' && !roleLower.includes('antagonist')) return false;
        if (selectedRoleFilter === 'confidant' && !roleLower.includes('confidant') && !roleLower.includes('partner') && !roleLower.includes('ally')) return false;
        if (selectedRoleFilter === 'mentor' && !roleLower.includes('mentor') && !roleLower.includes('keeper')) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inName = char.name.toLowerCase().includes(q);
        const inRole = char.role.toLowerCase().includes(q);
        const inMotivation = char.motivation.toLowerCase().includes(q);
        const inArc = char.arc.toLowerCase().includes(q);
        const inTraits = char.traits.some((t) => t.toLowerCase().includes(q));
        const inRelationships = char.relationships.toLowerCase().includes(q);
        const inNotes = char.notes.toLowerCase().includes(q);
        return inName || inRole || inMotivation || inArc || inTraits || inRelationships || inNotes;
      }
      return true;
    });
  }, [data.characters, selectedProjectFilter, selectedRoleFilter, searchQuery]);

  const selectedCharacter = useMemo(() => {
    if (!selectedCharacterId) return filteredCharacters[0] ?? data.characters[0] ?? null;
    return data.characters.find((c) => c.id === selectedCharacterId) ?? filteredCharacters[0] ?? null;
  }, [selectedCharacterId, data.characters, filteredCharacters]);

  const [isGeneratingStory, setIsGeneratingStory] = useState(false);

  const handleSaveCharacter = (input: Omit<Character, 'id'>) => {
    if (characterToEdit) {
      updateCharacter(characterToEdit.id, input);
      notify('Dossier Revised', `“${input.name}” dossier updated in your study ledger.`);
      setCharacterToEdit(null);
    } else {
      const created = createCharacter(input);
      notify('New Dossier Inscribed', `“${created.name}” indexed in the dramatis personae.`);
      setSelectedCharacterId(created.id);
    }
  };

  const handleRenameCharacter = (charId: string, newName: string) => {
    const char = data.characters.find((c) => c.id === charId);
    if (!char) return;
    const oldName = char.name;
    updateCharacter(charId, { name: newName });

    // Update references in all other characters' relationship texts
    data.characters.forEach((other) => {
      if (other.id === charId || !other.relationships) return;
      if (other.relationships.toLowerCase().includes(oldName.toLowerCase())) {
        const regex = new RegExp(oldName, 'gi');
        const updated = other.relationships.replace(regex, newName);
        updateCharacter(other.id, { relationships: updated });
      }
    });

    notify('Personae Renamed', `“${oldName}” renamed to “${newName}”.`);
  };

  const handleAutoGenerateFromStory = async (projectId: string, replaceExisting: boolean) => {
    const targetProject = data.projects.find((p) => p.id === projectId) || activeProject || data.projects[0];
    if (!targetProject) return;

    setIsGeneratingStory(true);
    try {
      const targetChapters = data.chapters.filter((ch) => ch.projectId === targetProject.id);

      const response = await fetch('/api/generate-character-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectTitle: targetProject.title,
          genre: targetProject.genre,
          synopsis: targetProject.synopsis,
          chapters: targetChapters.map((ch) => ({ title: ch.title, content: ch.content })),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const result = await response.json();
      if (result.characters && Array.isArray(result.characters) && result.characters.length > 0) {
        if (replaceExisting) {
          const toRemove = data.characters.filter((c) => c.projectId === targetProject.id);
          toRemove.forEach((c) => deleteCharacter(c.id));
        }

        result.characters.forEach((c: {
          name: string;
          role?: string;
          traits?: string[];
          motivation?: string;
          arc?: string;
          relationships?: string;
          notes?: string;
        }) => {
          createCharacter({
            name: c.name,
            role: c.role || 'Protagonist',
            projectId: targetProject.id,
            traits: Array.isArray(c.traits) && c.traits.length > 0 ? c.traits : ['Observant', 'Tenacious'],
            motivation: c.motivation || 'Resolves the central dramatic tension.',
            arc: c.arc || 'Transforms across the manuscript folios.',
            relationships: c.relationships || '',
            notes: c.notes || 'Generated from manuscript analysis.',
          });
        });

        notify(
          'Constellation Weaved',
          `Generated ${result.characters.length} characters & ties from “${targetProject.title}”.`
        );
      } else {
        notify('Generation Incomplete', 'Could not extract distinct characters from the provided excerpt.');
      }
    } catch (err) {
      console.error('Error generating character map:', err);
      notify('Constellation Weaving Failed', 'Unable to generate characters from manuscript. Please try again.');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleConfirmDelete = () => {
    if (!characterToDelete) return;
    const name = characterToDelete.name;
    deleteCharacter(characterToDelete.id);
    notify('Dossier Struck', `“${name}” removed from cast archives.`);
    if (selectedCharacterId === characterToDelete.id) {
      setSelectedCharacterId(null);
    }
    setCharacterToDelete(null);
  };

  return (
    <div className="max-w-[1260px] mx-auto px-5 sm:px-8 lg:px-12 pt-8 sm:pt-12 pb-24">
      {/* =====================================================================
          1. MASTHEAD & CAST STATISTICS
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
              Folio IV · Dramatis Personae
            </p>
          </div>

          <h1
            className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Character Studio
          </h1>

          <div
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm pt-1"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="font-mono-tabular">
              {data.characters.length} {data.characters.length === 1 ? 'dossier' : 'dossiers'} indexed
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{data.projects.length} volumes represented</span>
            <span aria-hidden="true">·</span>
            <span>Relationships mapped across cast</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setCharacterToEdit(null);
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-manuscript cursor-pointer transition-opacity hover:opacity-95 whitespace-nowrap shadow-sm"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: '#F4EFE5',
          }}
        >
          <UserPlus className="w-4 h-4" strokeWidth={1.4} />
          <span>Inscribe New Character</span>
        </button>
      </motion.section>

      {/* =====================================================================
          2. SEARCH, ARCHETYPE FILTERS & VIEW CONTROLS
         ===================================================================== */}
      <section className="mt-8 flex flex-wrap items-center justify-between gap-4">
        {/* Search Input & Volume Filter */}
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dossiers by name, trait, motivation, or note…"
              className="w-full pl-9 pr-8 py-2 text-sm font-manuscript border focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-primary)',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:opacity-75 cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Volume Filter Dropdown */}
          <select
            value={selectedProjectFilter}
            onChange={(e) => setSelectedProjectFilter(e.target.value)}
            className="px-3 py-2 text-xs font-manuscript border focus:outline-none cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-brass)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="all">All Manuscript Volumes ({data.characters.length})</option>
            {data.projects.map((p) => {
              const count = data.characters.filter((c) => c.projectId === p.id).length;
              return (
                <option key={p.id} value={p.id}>
                  {p.title} ({count})
                </option>
              );
            })}
          </select>
        </div>

        {/* View Mode & Archetype Segmented Controls (Buttons, not pills) */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Role Filters */}
          <div className="flex items-center gap-1 p-1 border rounded-sm" style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--bg-surface)' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'protagonist', label: 'Protagonists' },
              { id: 'antagonist', label: 'Antagonists' },
              { id: 'confidant', label: 'Confidants' },
              { id: 'mentor', label: 'Mentors' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedRoleFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-manuscript rounded-xs transition-colors cursor-pointer ${
                  selectedRoleFilter === tab.id
                    ? 'bg-[var(--accent-primary)] text-[#F4EFE5]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--burgundy-wash)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* View Mode Switcher: Dossiers vs Relationships Matrix */}
          <div className="flex items-center gap-1 p-1 border rounded-sm" style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--bg-surface)' }}>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Dossier Folios Grid"
              className={`p-1.5 rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-manuscript ${
                viewMode === 'cards'
                  ? 'bg-[var(--burgundy-wash)] text-[var(--accent-primary)] font-medium'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dossiers</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              title="Character Network Map & Constellation Graph"
              className={`p-1.5 rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-manuscript ${
                viewMode === 'matrix'
                  ? 'bg-[var(--burgundy-wash)] text-[var(--accent-primary)] font-medium'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Network Map</span>
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. MAIN STAGE: CARDS GRID OR RELATIONSHIP MATRIX
         ===================================================================== */}
      {viewMode === 'cards' ? (
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (8 cols): Dossier Cards Rack */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between text-xs font-manuscript px-1" style={{ color: 'var(--text-muted)' }}>
              <span>Showing {filteredCharacters.length} of {data.characters.length} characters</span>
              {searchQuery && <span>Filtered by “{searchQuery}”</span>}
            </div>

            {filteredCharacters.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                {filteredCharacters.map((char) => {
                  const isSelected = selectedCharacter?.id === char.id;
                  const proj = projectMap.get(char.projectId);
                  const monogram = char.name.charAt(0).toUpperCase();

                  return (
                    <motion.article
                      key={char.id}
                      onClick={() => setSelectedCharacterId(char.id)}
                      className={`relative paper-card p-5 cursor-pointer transition-all duration-200 text-left border ${
                        isSelected
                          ? 'ring-1 ring-[var(--accent-brass)] shadow-md'
                          : 'hover:border-[var(--border-brass)] hover:bg-[var(--burgundy-wash)]/20'
                      }`}
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: isSelected ? 'var(--accent-brass)' : 'var(--border-hairline)',
                      }}
                    >
                      {/* Top Header: Monogram Seal & Name */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <WaxSeal monogram={monogram} size={38} className="shrink-0" />
                          <div className="min-w-0">
                            <h3
                              className="font-display text-lg font-medium leading-tight truncate"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {char.name}
                            </h3>
                            <p className="small-caps-meta text-xs truncate mt-0.5" style={{ color: 'var(--accent-brass)' }}>
                              {char.role}
                            </p>
                          </div>
                        </div>

                        {/* Quick Actions (Edit & Delete) */}
                        <div
                          className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setCharacterToEdit(char);
                              setIsCreateOpen(true);
                            }}
                            title={`Revise ${char.name} dossier`}
                            aria-label={`Revise ${char.name} dossier`}
                            className="p-1 rounded hover:bg-[var(--burgundy-wash)] cursor-pointer"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            <Pencil className="w-3.5 h-3.5" strokeWidth={1.4} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCharacterToDelete(char)}
                            title={`Strike ${char.name} dossier`}
                            aria-label={`Delete ${char.name} dossier`}
                            className="p-1 rounded hover:bg-rose-950/20 hover:text-rose-600 cursor-pointer"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.4} />
                          </button>
                        </div>
                      </div>

                      {/* Traits (Clean unboxed text metadata with typographic separators - zero-pill rule!) */}
                      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {char.traits.map((trait, tIdx) => (
                          <React.Fragment key={trait}>
                            <span className="font-manuscript italic">{trait}</span>
                            {tIdx < char.traits.length - 1 && (
                              <span aria-hidden="true" style={{ color: 'var(--border-hairline)' }}>
                                ·
                              </span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>

                      {/* Motivation Quote */}
                      <p
                        className="mt-3 text-sm leading-snug line-clamp-2"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        “{char.motivation}”
                      </p>

                      {/* Volume & Relationship Footer */}
                      <div
                        className="mt-4 pt-3 border-t flex items-center justify-between text-xs font-manuscript"
                        style={{ borderColor: 'var(--border-hairline)' }}
                      >
                        <span className="italic truncate max-w-[160px]" style={{ color: 'var(--text-muted)' }}>
                          {proj?.title ?? 'Unbound Volume'}
                        </span>
                        <span className="underline underline-offset-4 cursor-pointer hover:opacity-80" style={{ color: 'var(--accent-primary)' }}>
                          View Dossier →
                        </span>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            ) : (
              <div className="paper-folio p-10 flex flex-col items-center justify-center text-center space-y-3">
                <EmptyCastIllustration className="w-56 h-36" />
                <p className="font-display italic text-lg" style={{ color: 'var(--text-secondary)' }}>
                  {data.characters.length === 0
                    ? 'No personae have been inscribed yet.'
                    : 'No character dossiers match your filter.'}
                </p>
                <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
                  {data.characters.length === 0
                    ? 'Record the protagonists, foils, and mentors who inhabit your literary universe.'
                    : 'Adjust your search query, caste filter, or volume selection to reveal dossiers.'}
                </p>
                {data.characters.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCharacterToEdit(null);
                      setIsCreateOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-manuscript cursor-pointer transition-opacity hover:opacity-90 mt-2"
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      color: '#F4EFE5',
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Inscribe First Personae</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedRoleFilter('all');
                      setSelectedProjectFilter('all');
                    }}
                    className="text-xs font-manuscript italic underline underline-offset-4 cursor-pointer hover:opacity-80 mt-1"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}

          </div>

          {/* Right Column (4 cols): Detailed Archival Dossier Inspection Folio */}
          <aside className="lg:col-span-4 sticky top-20">
            {selectedCharacter ? (
              <div
                className="relative paper-folio p-6 sm:p-7 space-y-5"
                style={{ transform: 'rotate(-0.3deg)' }}
              >
                <CornerOrnament position="tl" />
                <CornerOrnament position="tr" />
                <CornerOrnament position="bl" />
                <CornerOrnament position="br" />

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                      Archival Dossier Folio
                    </span>
                    <h2
                      className="font-display text-2xl font-medium mt-0.5 leading-snug text-balance"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {selectedCharacter.name}
                    </h2>
                    <p className="text-sm italic" style={{ color: 'var(--accent-brass)' }}>
                      {selectedCharacter.role}
                    </p>
                  </div>

                  <WaxSeal
                    monogram={selectedCharacter.name.charAt(0).toUpperCase()}
                    size={46}
                    className="shrink-0"
                  />
                </div>

                <FleuronDivider symbol="❦" />

                {/* Dossier Inscriptions */}
                <div className="space-y-4 text-sm leading-relaxed">
                  <div>
                    <span className="small-caps-meta text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
                      Core Motivation &amp; Driving Desire
                    </span>
                    <p className="italic text-base" style={{ color: 'var(--text-primary)' }}>
                      “{selectedCharacter.motivation}”
                    </p>
                  </div>

                  <div>
                    <span className="small-caps-meta text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
                      Narrative Arc &amp; Transformation
                    </span>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      {selectedCharacter.arc}
                    </p>
                  </div>

                  <div>
                    <span className="small-caps-meta text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
                      Cast Relationships &amp; Tensions
                    </span>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      {selectedCharacter.relationships}
                    </p>
                  </div>

                  {selectedCharacter.notes && (
                    <div>
                      <span className="small-caps-meta text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
                        Physicality &amp; Marginalia
                      </span>
                      <p className="text-xs font-mono-tabular" style={{ color: 'var(--text-muted)' }}>
                        {selectedCharacter.notes}
                      </p>
                    </div>
                  )}

                  {/* Volume Colophon */}
                  <div className="pt-3 border-t text-xs font-manuscript" style={{ borderColor: 'var(--border-hairline)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Bound in Volume: </span>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {projectMap.get(selectedCharacter.projectId)?.title ?? 'Unbound Volume'}
                    </span>
                  </div>
                </div>

                {/* Dossier Actions */}
                <div className="pt-4 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--border-hairline)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setCharacterToEdit(selectedCharacter);
                      setIsCreateOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-manuscript border cursor-pointer hover:bg-[var(--burgundy-wash)]"
                    style={{
                      borderColor: 'var(--border-brass)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit Dossier</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCharacterToDelete(selectedCharacter)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-manuscript text-rose-700 hover:text-rose-900 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Strike</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="paper-card p-6 text-center italic text-sm" style={{ color: 'var(--text-muted)' }}>
                Select a character dossier to inspect its complete archival folio.
              </div>
            )}
          </aside>
        </section>
      ) : (
        /* =====================================================================
            CHARACTER NETWORK SECTION: GRAPH (NODES & ARROWS) OR ARCHIVAL LEDGER
           ===================================================================== */
        <section className="mt-8 space-y-6">
          {/* Sub-header with Submode Switcher */}
          <div
            className="p-4 sm:p-5 paper-card border flex flex-wrap items-center justify-between gap-4"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-hairline)',
            }}
          >
            <div>
              <span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                Cast Dynamics &amp; Relational Map
              </span>
              <h2 className="font-display text-2xl font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                Character Relationship Network
              </h2>
              <p className="text-xs font-manuscript italic mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Interactive cartographic web mapping alliances, mentorships, rivalries, and blood ties with directional arrows.
              </p>
            </div>

            {/* Sub-mode segmented switcher: Constellation Graph vs Archival Ledger */}
            <div
              className="flex items-center gap-1 p-1 border rounded-sm"
              style={{
                borderColor: 'var(--border-hairline)',
                backgroundColor: 'var(--bg-canvas)',
              }}
            >
              <button
                type="button"
                onClick={() => setNetworkSubMode('graph')}
                className={`px-3 py-1.5 text-xs font-manuscript rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                  networkSubMode === 'graph'
                    ? 'bg-[var(--accent-primary)] text-[#F4EFE5] font-medium'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--burgundy-wash)]'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>Constellation Map (Nodes &amp; Arrows)</span>
              </button>
              <button
                type="button"
                onClick={() => setNetworkSubMode('ledger')}
                className={`px-3 py-1.5 text-xs font-manuscript rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                  networkSubMode === 'ledger'
                    ? 'bg-[var(--accent-primary)] text-[#F4EFE5] font-medium'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--burgundy-wash)]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Archival Ledger</span>
              </button>
            </div>
          </div>

          {/* Conditional Sub-View: Network Graph or Archival Ledger */}
          {networkSubMode === 'graph' ? (
            <CharacterNetworkGraph
              characters={filteredCharacters}
              allCharacters={data.characters}
              projects={data.projects}
              selectedProjectId={selectedProjectFilter}
              selectedCharacterId={selectedCharacterId}
              onSelectCharacter={setSelectedCharacterId}
              onEditCharacter={(char) => {
                setCharacterToEdit(char);
                setIsCreateOpen(true);
              }}
              onRenameCharacter={handleRenameCharacter}
              onDeleteCharacter={(char) => setCharacterToDelete(char)}
              onCreateCharacter={(input) => {
                const created = createCharacter(input);
                setSelectedCharacterId(created.id);
                notify('Personae Node Inscribed', `“${created.name}” added to constellation.`);
              }}
              onUpdateCharacterRelationships={(charId, updatedRels) => {
                updateCharacter(charId, { relationships: updatedRels });
                notify('Cast Dynamics Updated', 'Relationships inscribed into the constellation.');
              }}
              onAutoGenerateFromStory={handleAutoGenerateFromStory}
              isGeneratingStory={isGeneratingStory}
            />
          ) : (
            <div className="paper-card p-6 sm:p-8 space-y-4 border" style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--bg-surface)' }}>
              <div className="pb-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-hairline)' }}>
                <span className="small-caps-meta text-xs" style={{ color: 'var(--text-muted)' }}>
                  Showing {filteredCharacters.length} Character Folios in Ledger
                </span>
                <span className="text-xs font-manuscript italic" style={{ color: 'var(--accent-brass)' }}>
                  Click Update Dynamics to edit relationship clauses
                </span>
              </div>

              <div className="space-y-3.5">
                {filteredCharacters.map((char) => {
                  const proj = projectMap.get(char.projectId);

                  return (
                    <div
                      key={char.id}
                      className="p-4 rounded-sm border transition-colors hover:bg-[var(--burgundy-wash)]/30"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-hairline)',
                      }}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <WaxSeal monogram={char.name.charAt(0).toUpperCase()} size={32} />
                          <div>
                            <h4 className="font-display text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                              {char.name}
                            </h4>
                            <span className="small-caps-meta text-[11px]" style={{ color: 'var(--accent-brass)' }}>
                              {char.role} · {proj?.title ?? 'Unbound Volume'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCharacterId(char.id);
                              setNetworkSubMode('graph');
                            }}
                            className="text-xs font-manuscript underline underline-offset-4 cursor-pointer hover:opacity-80"
                            style={{ color: 'var(--accent-brass)' }}
                          >
                            Focus in Graph →
                          </button>
                          <span style={{ color: 'var(--border-hairline)' }}>·</span>
                          <button
                            type="button"
                            onClick={() => {
                              setCharacterToEdit(char);
                              setIsCreateOpen(true);
                            }}
                            className="text-xs font-manuscript italic underline underline-offset-4 cursor-pointer hover:opacity-80"
                            style={{ color: 'var(--accent-primary)' }}
                          >
                            Update Dynamics
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 pl-10 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        <span className="small-caps-meta text-[11px] block text-[var(--accent-brass)]">
                          Indexed Relationships:
                        </span>
                        <p className="mt-0.5 italic">
                          {char.relationships || 'No explicit ties indexed for this character yet.'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          4. DIALOGS
         ===================================================================== */}
      {/* Create / Edit Dossier Dialog */}
      <CharacterDossierDialog
        open={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setCharacterToEdit(null);
        }}
        character={characterToEdit}
        projects={data.projects}
        activeProjectId={selectedProjectFilter !== 'all' ? selectedProjectFilter : (activeProject?.id ?? '')}
        onSave={handleSaveCharacter}
      />

      {/* Unfolding Paper Confirmation Dialog for Striking Character */}
      <UnfoldingPaperDialog
        open={Boolean(characterToDelete)}
        onClose={() => setCharacterToDelete(null)}
        onConfirm={handleConfirmDelete}
        eyebrow="Cast Decree · Striking Personae"
        title={characterToDelete ? `Strike “${characterToDelete.name}” from Archives?` : ''}
        confirmLabel="Strike Dossier"
        cancelLabel="Preserve Record"
        isDestructive={true}
        description={
          characterToDelete && (
            <p>
              Are you certain you wish to strike{' '}
              <strong className="text-[var(--text-primary)] font-medium">“{characterToDelete.name}”</strong> from
              the dramatis personae? Their motivation notes, traits, and relationship records will be expunged from the volume.
            </p>
          )
        }
      />
    </div>
  );
};
