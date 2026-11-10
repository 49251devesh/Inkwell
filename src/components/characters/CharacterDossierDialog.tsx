import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Character, Project } from '../../types/inkwell';
import { CornerOrnament, WaxSeal } from '../ornaments/Ornaments';

interface CharacterDossierDialogProps {
  open: boolean;
  onClose: () => void;
  character?: Character | null; // null for create mode
  projects: Project[];
  activeProjectId: string;
  onSave: (data: Omit<Character, 'id'>) => void;
}

interface FormErrors {
  name?: string;
  role?: string;
  motivation?: string;
}

export const CharacterDossierDialog: React.FC<CharacterDossierDialogProps> = ({
  open,
  onClose,
  character,
  projects,
  activeProjectId,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Protagonist');
  const [projectId, setProjectId] = useState(activeProjectId);
  const [traitsInput, setTraitsInput] = useState('');
  const [motivation, setMotivation] = useState('');
  const [arc, setArc] = useState('');
  const [relationships, setRelationships] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const isEditing = Boolean(character);

  useEffect(() => {
    if (character) {
      setName(character.name);
      setRole(character.role);
      setProjectId(character.projectId);
      setTraitsInput(character.traits.join(', '));
      setMotivation(character.motivation);
      setArc(character.arc);
      setRelationships(character.relationships);
      setNotes(character.notes);
      setErrors({});
    } else {
      setName('');
      setRole('Protagonist');
      setProjectId(activeProjectId || (projects[0]?.id ?? ''));
      setTraitsInput('Observant, Resolute, Guarded');
      setMotivation('');
      setArc('');
      setRelationships('');
      setNotes('');
      setErrors({});
    }
  }, [character, open, activeProjectId, projects]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: FormErrors = {};

    if (!name.trim()) {
      nextErrors.name = 'A character dossier requires a name.';
    } else if (name.trim().length < 2) {
      nextErrors.name = 'Please enter at least two characters.';
    }

    if (!role.trim()) {
      nextErrors.role = 'Role or archetype is required.';
    }

    if (!motivation.trim()) {
      nextErrors.motivation = 'Core motivation or driving desire is required.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const traits = traitsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onSave({
      name: name.trim(),
      role: role.trim(),
      projectId,
      traits: traits.length > 0 ? traits : ['Unyielding'],
      motivation: motivation.trim(),
      arc: arc.trim() || 'Transformation unfolds across the manuscript folios.',
      relationships: relationships.trim() || 'Ties remain to be recorded in this volume.',
      notes: notes.trim(),
    });

    onClose();
  };

  const monogram = name.trim().charAt(0).toUpperCase() || '❦';

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="char-dialog-title"
        >
          {/* Dimmed Study Candlelight Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
          />

          {/* 3D Unfolding Paper Sheet */}
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
            className="relative z-10 w-full max-w-2xl border p-6 sm:p-8 my-auto overflow-hidden"
          >
            <CornerOrnament position="tl" />
            <CornerOrnament position="tr" />
            <CornerOrnament position="bl" />
            <CornerOrnament position="br" />

            {/* Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
              <div className="flex items-center gap-3">
                <WaxSeal monogram={monogram} size={42} className="shrink-0" />
                <div>
                  <p className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                    Dramatis Personae · Archival Record
                  </p>
                  <h2
                    id="char-dialog-title"
                    className="font-display text-2xl font-medium mt-0.5 leading-snug"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {isEditing ? `Revise Dossier: ${character?.name}` : 'Inscribe New Character Dossier'}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close dossier"
                className="p-1.5 transition-opacity hover:opacity-70 focus-visible:outline-2 cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-5 h-5" strokeWidth={1.4} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-7">
                  <label htmlFor="char-name" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Full Character Name
                  </label>
                  <input
                    id="char-name"
                    type="text"
                    autoFocus
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder="e.g. Clara Ashworth"
                    className="w-full px-3 py-2 text-base font-manuscript border focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: errors.name ? 'var(--accent-primary)' : 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs italic" style={{ color: 'var(--accent-primary)' }}>
                      {errors.name}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-5">
                  <label htmlFor="char-proj" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Manuscript Volume
                  </label>
                  <select
                    id="char-proj"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-manuscript border focus:outline-none cursor-pointer"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="char-role" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Role or Archetype
                  </label>
                  <input
                    id="char-role"
                    type="text"
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value);
                      if (errors.role) setErrors((prev) => ({ ...prev, role: undefined }));
                    }}
                    placeholder="e.g. Protagonist, Antagonist, Confidant, Mentor"
                    className="w-full px-3 py-1.5 text-sm font-manuscript border focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: errors.role ? 'var(--accent-primary)' : 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  {errors.role && (
                    <p className="mt-1 text-xs italic" style={{ color: 'var(--accent-primary)' }}>
                      {errors.role}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="char-traits" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Key Traits (comma-separated)
                  </label>
                  <input
                    id="char-traits"
                    type="text"
                    value={traitsInput}
                    onChange={(e) => setTraitsInput(e.target.value)}
                    placeholder="Tenacious, Guarded, Observant"
                    className="w-full px-3 py-1.5 text-sm font-manuscript border focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="char-motivation" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Core Motivation &amp; Driving Desire
                </label>
                <textarea
                  id="char-motivation"
                  rows={2}
                  value={motivation}
                  onChange={(e) => {
                    setMotivation(e.target.value);
                    if (errors.motivation) setErrors((prev) => ({ ...prev, motivation: undefined }));
                  }}
                  placeholder="What does this character want above all else? What internal lack drives them into conflict?"
                  className="w-full px-3 py-1.5 text-sm font-manuscript border resize-none focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: errors.motivation ? 'var(--accent-primary)' : 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                />
                {errors.motivation && (
                  <p className="mt-1 text-xs italic" style={{ color: 'var(--accent-primary)' }}>
                    {errors.motivation}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="char-arc" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Narrative Arc / Transformation
                  </label>
                  <textarea
                    id="char-arc"
                    rows={2}
                    value={arc}
                    onChange={(e) => setArc(e.target.value)}
                    placeholder="How do they change from opening chapter to resolution?"
                    className="w-full px-3 py-1.5 text-sm font-manuscript border resize-none focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="char-rels" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Key Relationships &amp; Tensions
                  </label>
                  <textarea
                    id="char-rels"
                    rows={2}
                    value={relationships}
                    onChange={(e) => setRelationships(e.target.value)}
                    placeholder="e.g. Partner to Julian; indebted to Magistrate Domingos"
                    className="w-full px-3 py-1.5 text-sm font-manuscript border resize-none focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="char-notes" className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Physicality, Speech Habits &amp; Marginalia
                </label>
                <input
                  id="char-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Stained fingertips from copperplate acid; speaks in terse nautical cadences"
                  className="w-full px-3 py-1.5 text-sm font-manuscript border focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--border-hairline)' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-manuscript italic cursor-pointer transition-opacity hover:opacity-75"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-manuscript tracking-wide cursor-pointer transition-colors whitespace-nowrap rounded-sm"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#F4EFE5',
                  }}
                >
                  {isEditing ? 'Save Dossier Changes' : 'Inscribe Dossier'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
