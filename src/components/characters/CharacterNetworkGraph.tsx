import React, { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  Link as LinkIcon,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Users,
  X,
  ZoomIn,
  ZoomOut,
  ArrowRight,
  Check,
  Wand2,
  UserPlus,
  BookOpen,
  Info,
} from 'lucide-react';
import { Character, Project } from '../../types/inkwell';
import { CornerOrnament, WaxSeal } from '../ornaments/Ornaments';

interface CharacterNetworkGraphProps {
  characters: Character[];
  allCharacters: Character[];
  projects: Project[];
  selectedProjectId: string;
  selectedCharacterId: string | null;
  onSelectCharacter: (id: string | null) => void;
  onEditCharacter: (char: Character) => void;
  onRenameCharacter: (characterId: string, newName: string) => void;
  onDeleteCharacter: (char: Character) => void;
  onCreateCharacter: (char: Omit<Character, 'id'>, initialPos?: { x: number; y: number }) => void;
  onUpdateCharacterRelationships: (characterId: string, updatedRelationships: string) => void;
  onAutoGenerateFromStory: (projectId: string, replaceExisting: boolean) => Promise<void>;
  isGeneratingStory?: boolean;
}

interface NodePosition {
  x: number;
  y: number;
}

interface GraphLink {
  id: string;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  label: string;
  rawClause: string;
  isMutual?: boolean;
}

export const CharacterNetworkGraph: React.FC<CharacterNetworkGraphProps> = ({
  characters,
  allCharacters,
  projects,
  selectedProjectId,
  selectedCharacterId,
  onSelectCharacter,
  onEditCharacter,
  onRenameCharacter,
  onDeleteCharacter,
  onCreateCharacter,
  onUpdateCharacterRelationships,
  onAutoGenerateFromStory,
  isGeneratingStory = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Canvas Viewport transform (Pan & Zoom)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Node Dragging State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Hover state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);

  // Selected link for inline editing / severing
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);
  const [editingLinkLabel, setEditingLinkLabel] = useState<string>('');
  const [isEditingLinkName, setIsEditingLinkName] = useState(false);

  // Character inline rename state
  const [renamingCharId, setRenamingCharId] = useState<string | null>(null);
  const [renamingText, setRenamingText] = useState<string>('');

  // Add Node Modal state
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeRole, setNewNodeRole] = useState('Protagonist');
  const [newNodeMotivation, setNewNodeMotivation] = useState('');
  const [newNodeProjectId, setNewNodeProjectId] = useState(
    selectedProjectId !== 'all' ? selectedProjectId : projects[0]?.id || ''
  );
  const [newNodeClickPos, setNewNodeClickPos] = useState<{ x: number; y: number } | null>(null);

  // Story Auto-Generate Dialog state
  const [isStoryGenOpen, setIsStoryGenOpen] = useState(false);
  const [storyGenProjectId, setStoryGenProjectId] = useState(
    selectedProjectId !== 'all' ? selectedProjectId : projects[0]?.id || ''
  );
  const [storyGenReplace, setStoryGenReplace] = useState(false);

  // Fullscreen container expansion
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Add / Connect Relationship Dialog State
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string>('');
  const [connectTargetId, setConnectTargetId] = useState<string>('');
  const [connectType, setConnectType] = useState<string>('Ally');
  const [connectCustomLabel, setConnectCustomLabel] = useState<string>('');
  const [connectIsBidirectional, setConnectIsBidirectional] = useState(true);

  // Project map for quick lookup
  const projectMap = useMemo(() => {
    return new Map(projects.map((p) => [p.id, p]));
  }, [projects]);

  // Quick lookup of character by ID
  const characterMap = useMemo(() => {
    return new Map(allCharacters.map((c) => [c.id, c]));
  }, [allCharacters]);

  // Width and height of virtual coordinate space
  const CANVAS_WIDTH = 960;
  const CANVAS_HEIGHT = 650;
  const CENTER_X = CANVAS_WIDTH / 2;
  const CENTER_Y = CANVAS_HEIGHT / 2;

  // Compute default node positions (constellation arrangement)
  const defaultPositions = useMemo(() => {
    const map: Record<string, NodePosition> = {};
    const count = characters.length;
    if (count === 0) return map;

    if (count === 1) {
      map[characters[0].id] = { x: CENTER_X, y: CENTER_Y };
      return map;
    }

    const radius = count > 5 ? 240 : 190;

    characters.forEach((char, index) => {
      const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
      const rx = radius * 1.15;
      const ry = radius * 0.9;
      const x = CENTER_X + rx * Math.cos(angle);
      const y = CENTER_Y + ry * Math.sin(angle);
      map[char.id] = { x: Math.round(x), y: Math.round(y) };
    });

    return map;
  }, [characters, CENTER_X, CENTER_Y]);

  // Actual positions stored in state (allows user dragging)
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});

  // Sync positions when characters change
  useEffect(() => {
    setPositions((prev) => {
      const next = { ...prev };
      characters.forEach((char) => {
        if (!next[char.id]) {
          next[char.id] = defaultPositions[char.id] || { x: CENTER_X, y: CENTER_Y };
        }
      });
      return next;
    });
  }, [characters, defaultPositions, CENTER_X, CENTER_Y]);

  // Reset constellation layout
  const handleResetLayout = () => {
    setPositions(defaultPositions);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedLink(null);
  };

  // ---------------------------------------------------------------------------
  // Parse relationships into directed graph links with labels and arrowheads
  // ---------------------------------------------------------------------------
  const links = useMemo<GraphLink[]>(() => {
    const list: GraphLink[] = [];

    characters.forEach((source) => {
      if (!source.relationships) return;

      const clauses = source.relationships
        .split(/[;.\n]+/)
        .map((c) => c.trim())
        .filter(Boolean);

      clauses.forEach((clause) => {
        for (const target of characters) {
          if (target.id === source.id) continue;

          const nameTokens = target.name.split(' ').map((t) => t.toLowerCase());
          const clauseLower = clause.toLowerCase();

          const hasFullName = clauseLower.includes(target.name.toLowerCase());
          const hasFirstName = nameTokens[0] && nameTokens[0].length >= 3 && clauseLower.includes(nameTokens[0]);
          const hasLastName =
            nameTokens.length > 1 &&
            nameTokens[nameTokens.length - 1].length >= 3 &&
            clauseLower.includes(nameTokens[nameTokens.length - 1]);

          if (hasFullName || hasFirstName || hasLastName) {
            let cleanLabel = clause
              .replace(new RegExp(target.name, 'gi'), '')
              .replace(new RegExp(nameTokens.join('|'), 'gi'), '')
              .replace(/\b(to|of|with|for|the|late|dr|master|reluctant|uneasy)\b/gi, '')
              .trim();

            if (!cleanLabel || cleanLabel.length < 2) {
              cleanLabel = 'Connected to';
            }

            cleanLabel = cleanLabel.charAt(0).toUpperCase() + cleanLabel.slice(1);
            if (cleanLabel.length > 24) {
              cleanLabel = cleanLabel.slice(0, 22) + '…';
            }

            const linkId = `${source.id}->${target.id}`;
            list.push({
              id: linkId,
              sourceId: source.id,
              targetId: target.id,
              sourceName: source.name,
              targetName: target.name,
              label: cleanLabel,
              rawClause: clause,
            });
            break;
          }
        }
      });
    });

    const linkMap = new Map<string, GraphLink>();
    list.forEach((l) => linkMap.set(`${l.sourceId}->${l.targetId}`, l));

    list.forEach((l) => {
      const reverseKey = `${l.targetId}->${l.sourceId}`;
      if (linkMap.has(reverseKey)) {
        l.isMutual = true;
      }
    });

    return list;
  }, [characters]);

  // ---------------------------------------------------------------------------
  // Canvas Mouse & Drag Handlers
  // ---------------------------------------------------------------------------
  const handleMouseDownCanvas = (e: React.MouseEvent<SVGSVGElement>) => {
    if (
      e.target === e.currentTarget ||
      (e.target as HTMLElement).tagName === 'rect' ||
      (e.target as HTMLElement).tagName === 'svg'
    ) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedLink(null);
    }
  };

  const handleDoubleClickCanvas = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - svgRect.left;
    const clientY = e.clientY - svgRect.top;
    const virtualX = (clientX - pan.x) / zoom;
    const virtualY = (clientY - pan.y) / zoom;

    setNewNodeClickPos({ x: Math.round(virtualX), y: Math.round(virtualY) });
    setNewNodeName('');
    setNewNodeRole('Protagonist');
    setNewNodeMotivation('');
    setIsAddNodeOpen(true);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    } else if (draggingNodeId) {
      const svgRect = e.currentTarget.getBoundingClientRect();
      const clientX = e.clientX - svgRect.left;
      const clientY = e.clientY - svgRect.top;

      const virtualX = (clientX - pan.x) / zoom - dragOffset.x;
      const virtualY = (clientY - pan.y) / zoom - dragOffset.y;

      setPositions((prev) => ({
        ...prev,
        [draggingNodeId]: {
          x: Math.max(50, Math.min(CANVAS_WIDTH - 50, virtualX)),
          y: Math.max(50, Math.min(CANVAS_HEIGHT - 50, virtualY)),
        },
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, charId: string) => {
    e.stopPropagation();
    const pos = positions[charId] || { x: CENTER_X, y: CENTER_Y };
    const svgRect = containerRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    const clientX = e.clientX - svgRect.left;
    const clientY = e.clientY - svgRect.top;
    const virtualX = (clientX - pan.x) / zoom;
    const virtualY = (clientY - pan.y) / zoom;

    setDragOffset({
      x: virtualX - pos.x,
      y: virtualY - pos.y,
    });
    setDraggingNodeId(charId);
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.55, Number((z - 0.15).toFixed(2))));

  // Selected character details
  const activeFocusCharacter = useMemo(() => {
    if (selectedCharacterId) {
      return allCharacters.find((c) => c.id === selectedCharacterId) || null;
    }
    if (hoveredNodeId) {
      return allCharacters.find((c) => c.id === hoveredNodeId) || null;
    }
    return null;
  }, [selectedCharacterId, hoveredNodeId, allCharacters]);

  // Connected links for active / hovered character
  const connectedLinks = useMemo(() => {
    const focusId = selectedCharacterId || hoveredNodeId;
    if (!focusId) return [];
    return links.filter((l) => l.sourceId === focusId || l.targetId === focusId);
  }, [selectedCharacterId, hoveredNodeId, links]);

  // Connected neighbor IDs for highlighting
  const connectedNodeIds = useMemo(() => {
    const set = new Set<string>();
    const focusId = selectedCharacterId || hoveredNodeId;
    if (focusId) {
      set.add(focusId);
      links.forEach((l) => {
        if (l.sourceId === focusId) set.add(l.targetId);
        if (l.targetId === focusId) set.add(l.sourceId);
      });
    }
    return set;
  }, [selectedCharacterId, hoveredNodeId, links]);

  // ---------------------------------------------------------------------------
  // Action Handlers: Connect, Rename, Sever Link, Add Node
  // ---------------------------------------------------------------------------

  // Inscribe connection (creates or appends arrow)
  const handleSaveConnection = () => {
    if (!connectSourceId || !connectTargetId || connectSourceId === connectTargetId) return;

    const sourceChar = characterMap.get(connectSourceId);
    const targetChar = characterMap.get(connectTargetId);
    if (!sourceChar || !targetChar) return;

    const relationLabel = connectCustomLabel.trim() || connectType;
    const newClause = `${relationLabel} of ${targetChar.name}`;

    const existingRels = sourceChar.relationships.trim();
    const updatedSourceRels = existingRels ? `${existingRels}; ${newClause}` : newClause;

    onUpdateCharacterRelationships(sourceChar.id, updatedSourceRels);

    if (connectIsBidirectional) {
      const targetExisting = targetChar.relationships.trim();
      const reverseClause = `${relationLabel} to ${sourceChar.name}`;
      const updatedTargetRels = targetExisting ? `${targetExisting}; ${reverseClause}` : reverseClause;
      onUpdateCharacterRelationships(targetChar.id, updatedTargetRels);
    }

    setIsConnectOpen(false);
    setConnectCustomLabel('');
  };

  // Sever / Delete Arrow (removes relationship clause)
  const handleSeverLink = (linkToSever: GraphLink) => {
    const sourceChar = characterMap.get(linkToSever.sourceId);
    if (!sourceChar) return;

    // Remove the target name clause from source relationships
    const clauses = sourceChar.relationships
      .split(/[;.\n]+/)
      .map((c) => c.trim())
      .filter((c) => {
        if (!c) return false;
        const targetTokens = linkToSever.targetName.toLowerCase().split(' ');
        const cLower = c.toLowerCase();
        return !targetTokens.some((t) => t.length >= 3 && cLower.includes(t));
      });

    onUpdateCharacterRelationships(sourceChar.id, clauses.join('; '));

    // Also remove reverse clause if it was mutual
    if (linkToSever.isMutual) {
      const targetChar = characterMap.get(linkToSever.targetId);
      if (targetChar) {
        const targetClauses = targetChar.relationships
          .split(/[;.\n]+/)
          .map((c) => c.trim())
          .filter((c) => {
            if (!c) return false;
            const sourceTokens = linkToSever.sourceName.toLowerCase().split(' ');
            const cLower = c.toLowerCase();
            return !sourceTokens.some((t) => t.length >= 3 && cLower.includes(t));
          });
        onUpdateCharacterRelationships(targetChar.id, targetClauses.join('; '));
      }
    }

    setSelectedLink(null);
  };

  // Save updated Arrow Label (changes relationship name dynamically)
  const handleUpdateLinkLabel = () => {
    if (!selectedLink || !editingLinkLabel.trim()) return;

    const sourceChar = characterMap.get(selectedLink.sourceId);
    if (!sourceChar) return;

    // Replace the clause
    const clauses = sourceChar.relationships
      .split(/[;.\n]+/)
      .map((c) => c.trim())
      .filter(Boolean);

    const targetTokens = selectedLink.targetName.toLowerCase().split(' ');
    const updatedClauses = clauses.map((c) => {
      const cLower = c.toLowerCase();
      const isTargetClause = targetTokens.some((t) => t.length >= 3 && cLower.includes(t));
      if (isTargetClause) {
        return `${editingLinkLabel.trim()} of ${selectedLink.targetName}`;
      }
      return c;
    });

    onUpdateCharacterRelationships(sourceChar.id, updatedClauses.join('; '));
    setIsEditingLinkName(false);
    setSelectedLink((prev) => (prev ? { ...prev, label: editingLinkLabel.trim() } : null));
  };

  // Submit Character Rename
  const handleSaveCharacterRename = (charId: string) => {
    if (!renamingText.trim()) return;
    onRenameCharacter(charId, renamingText.trim());
    setRenamingCharId(null);
    setRenamingText('');
  };

  // Create Node from map
  const handleCreateNewNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim()) return;

    const pos = newNodeClickPos || { x: CENTER_X, y: CENTER_Y };
    onCreateCharacter(
      {
        name: newNodeName.trim(),
        role: newNodeRole.trim() || 'Protagonist',
        projectId: newNodeProjectId || (projects[0]?.id ?? ''),
        traits: ['Resolute', 'Observant'],
        motivation: newNodeMotivation.trim() || 'Desires to uncover the truth.',
        arc: 'Transforms over the course of the manuscript.',
        relationships: '',
        notes: 'Inscribed directly on the constellation canvas.',
      },
      pos
    );

    setIsAddNodeOpen(false);
    setNewNodeName('');
    setNewNodeMotivation('');
    setNewNodeClickPos(null);
  };

  return (
    <div
      ref={containerRef}
      className={`relative paper-card border overflow-hidden transition-all duration-300 ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : 'w-full'
      }`}
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-hairline)',
        minHeight: isFullscreen ? 'calc(100vh - 32px)' : '680px',
      }}
    >
      <CornerOrnament position="tl" />
      <CornerOrnament position="tr" />
      <CornerOrnament position="bl" />
      <CornerOrnament position="br" />

      {/* =====================================================================
          TOP TOOLBAR & HUD OVERLAY
         ===================================================================== */}
      <div
        className="relative z-10 p-4 sm:px-6 sm:py-3.5 border-b flex flex-wrap items-center justify-between gap-3"
        style={{
          borderColor: 'var(--border-hairline)',
          backgroundColor: 'rgba(250, 246, 237, 0.94)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded border flex items-center justify-center shrink-0"
            style={{
              borderColor: 'var(--border-brass)',
              backgroundColor: 'var(--burgundy-wash)',
              color: 'var(--accent-brass)',
            }}
          >
            <Compass className="w-4 h-4" strokeWidth={1.4} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                Constellation Atelier
              </span>
              <span aria-hidden="true" style={{ color: 'var(--border-hairline)' }}>·</span>
              <span className="text-xs font-mono-tabular" style={{ color: 'var(--text-muted)' }}>
                {characters.length} Nodes · {links.length} Relations
              </span>
            </div>
            <h3
              className="font-display text-base sm:text-lg font-medium leading-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Interactive Character Map
            </h3>
          </div>
        </div>

        {/* Action Controls: Add Node, Auto-Generate, Connect, Reset, Zoom */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto-Generate from Story Button */}
          <button
            type="button"
            onClick={() => setIsStoryGenOpen(true)}
            disabled={isGeneratingStory}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-manuscript rounded-xs border cursor-pointer transition-colors shadow-xs hover:bg-[var(--burgundy-wash)]"
            style={{
              borderColor: 'var(--accent-brass)',
              backgroundColor: 'var(--bg-canvas)',
              color: 'var(--accent-primary)',
            }}
            title="Automatically weave characters and relations from your manuscript story text"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-[var(--accent-brass)]" />
            <span className="font-medium">Generate from Story</span>
          </button>

          {/* Add Character Node Button */}
          <button
            type="button"
            onClick={() => {
              setNewNodeClickPos(null);
              setNewNodeName('');
              setNewNodeMotivation('');
              setIsAddNodeOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-manuscript rounded-xs border cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)]"
            style={{
              borderColor: 'var(--border-brass)',
              color: 'var(--text-primary)',
            }}
            title="Add a new character node to the map"
          >
            <UserPlus className="w-3.5 h-3.5 text-[var(--accent-brass)]" />
            <span>+ Add Node</span>
          </button>

          {/* Connect Cast Button */}
          <button
            type="button"
            onClick={() => {
              setConnectSourceId(selectedCharacterId || characters[0]?.id || '');
              setConnectTargetId(characters[1]?.id || '');
              setIsConnectOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-manuscript rounded-xs border cursor-pointer transition-colors hover:bg-[var(--burgundy-wash)]"
            style={{
              borderColor: 'var(--border-brass)',
              color: 'var(--text-primary)',
            }}
            title="Draw a relationship arrow between two characters"
          >
            <LinkIcon className="w-3.5 h-3.5 text-[var(--accent-brass)]" />
            <span>Connect Arrow</span>
          </button>

          {/* Reset Layout */}
          <button
            type="button"
            onClick={handleResetLayout}
            className="p-1.5 rounded border transition-colors cursor-pointer hover:bg-[var(--burgundy-wash)]"
            style={{
              borderColor: 'var(--border-hairline)',
              color: 'var(--text-secondary)',
            }}
            title="Reset Constellation Layout &amp; Zoom"
            aria-label="Reset Constellation Layout & Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 pl-1">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 rounded border transition-colors cursor-pointer hover:bg-[var(--burgundy-wash)]"
              style={{
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-secondary)',
              }}
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] font-mono-tabular px-1 min-w-[36px] text-center" style={{ color: 'var(--text-muted)' }}>
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 rounded border transition-colors cursor-pointer hover:bg-[var(--burgundy-wash)]"
              style={{
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-secondary)',
              }}
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded border transition-colors cursor-pointer hover:bg-[var(--burgundy-wash)] ml-1"
            style={{
              borderColor: 'var(--border-hairline)',
              color: 'var(--text-secondary)',
            }}
            title={isFullscreen ? 'Exit Expanded View' : 'Expand Constellation'}
            aria-label={isFullscreen ? 'Exit Expanded View' : 'Expand Constellation'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* =====================================================================
          MAIN INTERACTIVE SVG MAP BOARD
         ===================================================================== */}
      <div
        className="relative w-full overflow-hidden select-none"
        style={{ height: isFullscreen ? 'calc(100vh - 120px)' : '600px' }}
      >
        <svg
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDownCanvas}
          onDoubleClick={handleDoubleClickCanvas}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* SVG Definitions */}
          <defs>
            <marker
              id="arrow-brass"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--brass-readable)" />
            </marker>

            <marker
              id="arrow-burgundy"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#713D43" />
            </marker>

            <marker
              id="arrow-faded"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 2 L 7 5 L 0 8 z" fill="var(--muted-ink)" opacity="0.3" />
            </marker>

            <filter id="parchment-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#24231F" floodOpacity="0.12" />
            </filter>
            <filter id="node-highlight-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#713D43" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Virtual Transform Layer (Pan & Zoom) */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 1. Cartographic Grid Lines & Astrolabe Markings */}
            <g opacity="0.45" stroke="var(--border-hairline)" strokeWidth="0.8">
              <circle cx={CENTER_X} cy={CENTER_Y} r="130" fill="none" strokeDasharray="3 5" />
              <circle cx={CENTER_X} cy={CENTER_Y} r="240" fill="none" strokeDasharray="4 6" />
              <circle cx={CENTER_X} cy={CENTER_Y} r="330" fill="none" strokeOpacity="0.2" />

              <line x1={CENTER_X} y1={40} x2={CENTER_X} y2={CANVAS_HEIGHT - 40} strokeDasharray="2 4" strokeOpacity="0.4" />
              <line x1={50} y1={CENTER_Y} x2={CANVAS_WIDTH - 50} y2={CENTER_Y} strokeDasharray="2 4" strokeOpacity="0.4" />

              <circle cx={CENTER_X} cy={CENTER_Y} r="4" fill="var(--brass)" fillOpacity="0.5" />
              <circle cx={CENTER_X} cy={CENTER_Y} r="18" fill="none" stroke="var(--accent-brass)" strokeOpacity="0.3" />
            </g>

            {/* 2. Directed Edges (Arrows & Relationship Curves) */}
            <g className="edges-layer">
              {links.map((link) => {
                const sourcePos = positions[link.sourceId];
                const targetPos = positions[link.targetId];
                if (!sourcePos || !targetPos) return null;

                const isFocusSource = selectedCharacterId === link.sourceId || hoveredNodeId === link.sourceId;
                const isFocusTarget = selectedCharacterId === link.targetId || hoveredNodeId === link.targetId;
                const isFocused = isFocusSource || isFocusTarget || selectedLink?.id === link.id;
                const hasAnyFocus = Boolean(selectedCharacterId || hoveredNodeId || selectedLink);
                const isDimmed = hasAnyFocus && !isFocused;

                const dx = targetPos.x - sourcePos.x;
                const dy = targetPos.y - sourcePos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist === 0) return null;

                const nx = -dy / dist;
                const ny = dx / dist;

                const curvature = link.isMutual ? 32 : 18;
                const midX = (sourcePos.x + targetPos.x) / 2 + nx * curvature;
                const midY = (sourcePos.y + targetPos.y) / 2 + ny * curvature;

                const nodeRadius = 38;
                const targetDx = midX - targetPos.x;
                const targetDy = midY - targetPos.y;
                const targetDist = Math.sqrt(targetDx * targetDx + targetDy * targetDy);
                const endX = targetPos.x + (targetDx / targetDist) * nodeRadius;
                const endY = targetPos.y + (targetDy / targetDist) * nodeRadius;

                const sourceDx = midX - sourcePos.x;
                const sourceDy = midY - sourcePos.y;
                const sourceDist = Math.sqrt(sourceDx * sourceDx + sourceDy * sourceDy);
                const startX = sourcePos.x + (sourceDx / sourceDist) * nodeRadius;
                const startY = sourcePos.y + (sourceDy / sourceDist) * nodeRadius;

                const pathData = `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;

                const markerId = isFocused
                  ? 'url(#arrow-burgundy)'
                  : isDimmed
                  ? 'url(#arrow-faded)'
                  : 'url(#arrow-brass)';

                const strokeColor = isFocused
                  ? '#713D43'
                  : isDimmed
                  ? 'var(--muted-ink)'
                  : 'var(--brass-readable)';

                const strokeWidth = isFocused ? 2.4 : isDimmed ? 0.9 : 1.4;
                const strokeOpacity = isFocused ? 1 : isDimmed ? 0.2 : 0.65;

                return (
                  <g
                    key={link.id}
                    className="cursor-pointer transition-opacity duration-200"
                    onMouseEnter={() => setHoveredLinkId(link.id)}
                    onMouseLeave={() => setHoveredLinkId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLink(link);
                      setEditingLinkLabel(link.label);
                      setIsEditingLinkName(false);
                    }}
                  >
                    <path d={pathData} fill="none" stroke="transparent" strokeWidth={18} />

                    <path
                      d={pathData}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeOpacity={strokeOpacity}
                      strokeDasharray={link.label.toLowerCase().includes('secret') ? '4 3' : undefined}
                      markerEnd={markerId}
                    />

                    {/* Antique Cartouche label along the curve */}
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x={-(link.label.length * 3.4 + 10)}
                        y={-9}
                        width={link.label.length * 6.8 + 20}
                        height={18}
                        rx={3}
                        fill="var(--bg-surface)"
                        stroke={isFocused ? '#713D43' : 'var(--border-hairline)'}
                        strokeWidth={isFocused ? 1.4 : 0.8}
                        filter="url(#parchment-glow)"
                        opacity={isDimmed ? 0.35 : 0.95}
                      />
                      <text
                        x={0}
                        y={3.5}
                        textAnchor="middle"
                        fontFamily="'EB Garamond', Georgia, serif"
                        fontSize="11"
                        fontStyle="italic"
                        fill={isFocused ? '#713D43' : 'var(--text-secondary)'}
                        fontWeight={isFocused ? '600' : '400'}
                        opacity={isDimmed ? 0.4 : 1}
                        className="select-none pointer-events-none"
                      >
                        {link.label}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>

            {/* 3. Character Nodes */}
            <g className="nodes-layer">
              {characters.map((char) => {
                const pos = positions[char.id] || { x: CENTER_X, y: CENTER_Y };
                const isSelected = selectedCharacterId === char.id;
                const isHovered = hoveredNodeId === char.id;
                const isConnected = connectedNodeIds.has(char.id);
                const hasFocus = Boolean(selectedCharacterId || hoveredNodeId || selectedLink);
                const isDimmed = hasFocus && !isConnected;

                const monogram = char.name.charAt(0).toUpperCase();

                return (
                  <g
                    key={char.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer"
                    onMouseDown={(e) => handleNodeMouseDown(e, char.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCharacter(isSelected ? null : char.id);
                      setSelectedLink(null);
                    }}
                    onMouseEnter={() => setHoveredNodeId(char.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    filter={isSelected || isHovered ? 'url(#node-highlight-glow)' : 'url(#parchment-glow)'}
                    opacity={isDimmed ? 0.38 : 1}
                  >
                    {/* Outer Ring */}
                    {(isSelected || isHovered) && (
                      <circle
                        r="44"
                        fill="none"
                        stroke="var(--accent-brass)"
                        strokeWidth="1.2"
                        strokeDasharray="4 3"
                        className="animate-spin-slow"
                        style={{ transformOrigin: '0 0' }}
                      />
                    )}

                    {/* Outer Paper Ring */}
                    <circle
                      r="36"
                      fill="var(--bg-surface)"
                      stroke={isSelected ? '#713D43' : isHovered ? 'var(--accent-brass)' : 'var(--border-brass)'}
                      strokeWidth={isSelected ? 2.4 : 1.4}
                    />

                    {/* Wax Seal Core */}
                    <circle
                      r="26"
                      fill={isSelected ? '#582D32' : '#713D43'}
                      stroke="#462025"
                      strokeWidth="1"
                    />

                    {/* Wax Rim */}
                    <circle
                      r="23"
                      fill="none"
                      stroke="#9D6068"
                      strokeWidth="0.8"
                      strokeOpacity="0.6"
                    />

                    {/* Monogram Letter */}
                    <text
                      x="0"
                      y="6"
                      textAnchor="middle"
                      fill="#FAF6ED"
                      fontFamily="'Fraunces', Georgia, serif"
                      fontSize="17"
                      fontWeight="600"
                      fontStyle="italic"
                      className="select-none pointer-events-none"
                    >
                      {monogram}
                    </text>

                    {/* Character Name Plaque */}
                    <g transform="translate(0, 48)">
                      <rect
                        x={-(char.name.length * 3.7 + 10)}
                        y={-8}
                        width={char.name.length * 7.4 + 20}
                        height={28}
                        rx={3}
                        fill="var(--bg-canvas)"
                        stroke={isSelected ? '#713D43' : 'var(--border-hairline)'}
                        strokeWidth={isSelected ? 1.2 : 0.8}
                      />
                      <text
                        x="0"
                        y="4"
                        textAnchor="middle"
                        fill="var(--text-primary)"
                        fontFamily="'Fraunces', Georgia, serif"
                        fontSize="12"
                        fontWeight="600"
                        className="select-none pointer-events-none"
                      >
                        {char.name}
                      </text>
                      <text
                        x="0"
                        y="15"
                        textAnchor="middle"
                        fill={isSelected ? '#713D43' : 'var(--accent-brass)'}
                        fontFamily="'EB Garamond', Georgia, serif"
                        fontSize="9.5"
                        fontStyle="italic"
                        className="select-none pointer-events-none"
                      >
                        {char.role}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        {/* Empty State */}
        {characters.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <p className="font-display italic text-lg" style={{ color: 'var(--text-secondary)' }}>
              No character dossiers yet in this volume.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddNodeOpen(true)}
                className="px-4 py-2 text-xs font-manuscript border cursor-pointer hover:bg-[var(--burgundy-wash)]"
                style={{ borderColor: 'var(--border-brass)', color: 'var(--text-primary)' }}
              >
                + Add First Character Node
              </button>
              <button
                type="button"
                onClick={() => setIsStoryGenOpen(true)}
                className="px-4 py-2 text-xs font-manuscript cursor-pointer"
                style={{ backgroundColor: 'var(--accent-primary)', color: '#F4EFE5' }}
              >
                Generate Constellation from Story
              </button>
            </div>
          </div>
        )}

        {/* Informational Canvas Guide Banner */}
        <div
          className="absolute bottom-3 left-3 px-3 py-2 border rounded-xs text-[11px] font-manuscript flex items-center gap-3 backdrop-blur-sm pointer-events-none"
          style={{
            backgroundColor: 'rgba(250, 246, 237, 0.9)',
            borderColor: 'var(--border-hairline)',
            color: 'var(--text-muted)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#713D43] inline-block" />
            <span>Click Node: Inspect / Rename / Strike</span>
          </div>
          <span>·</span>
          <div className="flex items-center gap-1.5">
            <ArrowRight className="w-3 h-3 text-[var(--brass-readable)]" />
            <span>Click Arrow: Edit Name / Sever</span>
          </div>
          <span>·</span>
          <span className="italic hidden sm:inline">Double-click empty canvas to add node</span>
        </div>

        {/* ===================================================================
            FLOATING POPUP: SELECTED ARROW / RELATIONSHIP MANAGER
           =================================================================== */}
        <AnimatePresence>
          {selectedLink && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={{ duration: 0.18 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-20 paper-folio p-3.5 border shadow-xl flex items-center gap-3 max-w-lg"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-brass)',
              }}
            >
              <div className="flex items-center gap-2 text-xs font-manuscript min-w-0">
                <span className="font-semibold text-[var(--text-primary)] truncate max-w-[100px]">
                  {selectedLink.sourceName}
                </span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 text-[var(--accent-brass)]" />
                <span className="font-semibold text-[var(--text-primary)] truncate max-w-[100px]">
                  {selectedLink.targetName}
                </span>
                <span style={{ color: 'var(--border-hairline)' }}>:</span>
              </div>

              {isEditingLinkName ? (
                <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                  <input
                    type="text"
                    value={editingLinkLabel}
                    onChange={(e) => setEditingLinkLabel(e.target.value)}
                    autoFocus
                    placeholder="e.g. Bitter Rival, Secret Patron"
                    className="px-2 py-1 text-xs font-manuscript border focus:outline-none flex-1"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-brass)',
                      color: 'var(--text-primary)',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdateLinkLabel();
                      if (e.key === 'Escape') setIsEditingLinkName(false);
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleUpdateLinkLabel}
                    title="Save relationship name"
                    className="p-1 rounded bg-[var(--accent-primary)] text-[#F4EFE5] cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingLinkName(false)}
                    title="Cancel"
                    className="p-1 rounded hover:bg-[var(--burgundy-wash)] text-[var(--text-muted)] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-manuscript italic font-medium px-2 py-0.5 rounded bg-[var(--burgundy-wash)] text-[var(--accent-primary)]">
                    “{selectedLink.label}”
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLinkLabel(selectedLink.label);
                      setIsEditingLinkName(true);
                    }}
                    className="p-1 hover:bg-[var(--burgundy-wash)] rounded text-xs font-manuscript flex items-center gap-1 cursor-pointer"
                    style={{ color: 'var(--text-secondary)' }}
                    title="Change relationship name"
                  >
                    <Pencil className="w-3 h-3" />
                    <span className="hidden sm:inline">Rename</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSeverLink(selectedLink)}
                    className="p-1 hover:bg-rose-950/20 text-rose-700 rounded text-xs font-manuscript flex items-center gap-1 cursor-pointer"
                    title="Delete / Sever this relationship arrow"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span className="hidden sm:inline">Sever Arrow</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedLink(null)}
                className="p-1 text-[var(--text-muted)] hover:opacity-70 cursor-pointer ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===================================================================
            ACTIVE NODE INSPECTION & DYNAMIC EDIT CARD (Bottom Right)
           =================================================================== */}
        <AnimatePresence>
          {activeFocusCharacter && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.95 }}
              transition={{ duration: 0.22 }}
              className="absolute bottom-3 right-3 w-84 max-w-[calc(100vw-32px)] paper-folio p-4 border shadow-xl space-y-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--accent-brass)',
              }}
            >
              {/* Header: Name / Inline Rename / Actions */}
              <div className="flex items-start justify-between gap-2 pb-2 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <WaxSeal monogram={activeFocusCharacter.name.charAt(0).toUpperCase()} size={32} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    {renamingCharId === activeFocusCharacter.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={renamingText}
                          onChange={(e) => setRenamingText(e.target.value)}
                          autoFocus
                          className="w-full px-1.5 py-0.5 text-xs font-semibold font-display border focus:outline-none"
                          style={{
                            backgroundColor: 'var(--bg-canvas)',
                            borderColor: 'var(--accent-brass)',
                            color: 'var(--text-primary)',
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveCharacterRename(activeFocusCharacter.id);
                            if (e.key === 'Escape') setRenamingCharId(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveCharacterRename(activeFocusCharacter.id)}
                          className="p-1 bg-[var(--accent-primary)] text-[#F4EFE5] rounded cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-display text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {activeFocusCharacter.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingCharId(activeFocusCharacter.id);
                            setRenamingText(activeFocusCharacter.name);
                          }}
                          title="Rename character"
                          className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] font-manuscript italic truncate" style={{ color: 'var(--accent-brass)' }}>
                      {activeFocusCharacter.role}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Delete Character Node Button */}
                  <button
                    type="button"
                    onClick={() => onDeleteCharacter(activeFocusCharacter)}
                    title="Delete character and sever their constellation arrows"
                    className="p-1 hover:bg-rose-950/20 text-rose-700 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  {/* Edit Full Dossier */}
                  <button
                    type="button"
                    onClick={() => onEditCharacter(activeFocusCharacter)}
                    title="Edit complete character dossier"
                    className="p-1 hover:bg-[var(--burgundy-wash)] rounded cursor-pointer"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <BookOpen className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectCharacter(null)}
                    className="p-1 hover:bg-[var(--burgundy-wash)] rounded cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Motivation */}
              <div className="text-xs">
                <span className="small-caps-meta text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                  Motivation
                </span>
                <p className="italic leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                  “{activeFocusCharacter.motivation}”
                </p>
              </div>

              {/* Connected Relationships with inline Rename & Delete options */}
              <div className="text-xs space-y-1.5 pt-1 border-t" style={{ borderColor: 'var(--border-hairline)' }}>
                <div className="flex items-center justify-between">
                  <span className="small-caps-meta text-[10px]" style={{ color: 'var(--accent-brass)' }}>
                    Connected Ties ({connectedLinks.length}):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setConnectSourceId(activeFocusCharacter.id);
                      setConnectTargetId(characters.find((c) => c.id !== activeFocusCharacter.id)?.id || '');
                      setIsConnectOpen(true);
                    }}
                    className="text-[11px] font-manuscript underline underline-offset-2 cursor-pointer hover:opacity-80"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    + Draw Arrow
                  </button>
                </div>

                {connectedLinks.length > 0 ? (
                  <div className="max-h-28 overflow-y-auto space-y-1 font-manuscript text-[11px] pr-1">
                    {connectedLinks.map((l) => {
                      const isOutgoing = l.sourceId === activeFocusCharacter.id;
                      const otherName = isOutgoing ? l.targetName : l.sourceName;
                      return (
                        <div
                          key={l.id}
                          className="flex items-center justify-between gap-1.5 p-1 rounded bg-[var(--burgundy-wash)]/40 hover:bg-[var(--burgundy-wash)] transition-colors"
                        >
                          <span className="font-medium truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                            {isOutgoing ? '→ To ' : '← From '} {otherName}
                          </span>
                          <span className="italic shrink-0 text-[10px]" style={{ color: 'var(--accent-primary)' }}>
                            {l.label}
                          </span>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLink(l);
                                setEditingLinkLabel(l.label);
                                setIsEditingLinkName(true);
                              }}
                              title="Rename relationship"
                              className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSeverLink(l)}
                              title="Sever / Delete this arrow"
                              className="p-0.5 text-[var(--text-muted)] hover:text-rose-700 cursor-pointer"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="italic text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    No connections parsed for this character yet.
                  </p>
                )}
              </div>

              {/* Volume Colophon */}
              <div className="pt-2 border-t flex items-center justify-between text-[11px] font-manuscript" style={{ borderColor: 'var(--border-hairline)' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {projectMap.get(activeFocusCharacter.projectId)?.title ?? 'Unbound Volume'}
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteCharacter(activeFocusCharacter)}
                  className="text-rose-700 hover:text-rose-900 cursor-pointer text-[10px] uppercase font-mono-tabular tracking-wider"
                >
                  Strike Personae
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* =====================================================================
          DIALOG 1: INSCRIBE NEW CHARACTER NODE
         ===================================================================== */}
      <AnimatePresence>
        {isAddNodeOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddNodeOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
            />

            <motion.div
              initial={{ opacity: 0, scaleY: 0.88, rotateX: -12 }}
              animate={{ opacity: 1, scaleY: 1, rotateX: 0 }}
              exit={{ opacity: 0, scaleY: 0.9, rotateX: -8 }}
              transition={{ duration: 0.3 }}
              style={{
                transformOrigin: 'top center',
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-brass)',
              }}
              className="relative z-10 w-full max-w-md border p-6 space-y-4 shadow-2xl"
            >
              <CornerOrnament position="tl" />
              <CornerOrnament position="tr" />
              <CornerOrnament position="bl" />
              <CornerOrnament position="br" />

              <div className="flex items-start justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
                <div>
                  <span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                    Constellation · Add Personae Node
                  </span>
                  <h3 className="font-display text-xl font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    Inscribe New Node
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddNodeOpen(false)}
                  className="p-1 text-[var(--text-muted)] hover:opacity-70 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateNewNode} className="space-y-3.5 text-sm font-manuscript">
                <div>
                  <label className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Character Name *
                  </label>
                  <input
                    type="text"
                    autoFocus
                    required
                    value={newNodeName}
                    onChange={(e) => setNewNodeName(e.target.value)}
                    placeholder="e.g. Master Domingos, Arthur Vance"
                    className="w-full px-3 py-1.5 text-sm font-manuscript border focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Role or Archetype
                    </label>
                    <input
                      type="text"
                      value={newNodeRole}
                      onChange={(e) => setNewNodeRole(e.target.value)}
                      placeholder="Protagonist, Mentor, Rival"
                      className="w-full px-3 py-1.5 text-xs font-manuscript border focus:outline-none"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-hairline)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>

                  <div>
                    <label className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Manuscript Volume
                    </label>
                    <select
                      value={newNodeProjectId}
                      onChange={(e) => setNewNodeProjectId(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs font-manuscript border focus:outline-none cursor-pointer"
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
                  <label className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Core Motivation / Driving Desire
                  </label>
                  <textarea
                    rows={2}
                    value={newNodeMotivation}
                    onChange={(e) => setNewNodeMotivation(e.target.value)}
                    placeholder="What drives this character into conflict?"
                    className="w-full px-3 py-1.5 text-xs font-manuscript border resize-none focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div className="pt-2 border-t flex items-center justify-end gap-2.5" style={{ borderColor: 'var(--border-hairline)' }}>
                  <button
                    type="button"
                    onClick={() => setIsAddNodeOpen(false)}
                    className="px-3 py-1.5 text-xs font-manuscript italic cursor-pointer"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newNodeName.trim()}
                    className="px-4 py-1.5 text-xs font-manuscript rounded-xs cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      color: '#F4EFE5',
                    }}
                  >
                    Drop Node on Map
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          DIALOG 2: AUTOMATICALLY GENERATE MAP FROM STORY TEXT
         ===================================================================== */}
      <AnimatePresence>
        {isStoryGenOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isGeneratingStory && setIsStoryGenOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
            />

            <motion.div
              initial={{ opacity: 0, scaleY: 0.88, rotateX: -12 }}
              animate={{ opacity: 1, scaleY: 1, rotateX: 0 }}
              exit={{ opacity: 0, scaleY: 0.9, rotateX: -8 }}
              transition={{ duration: 0.3 }}
              style={{
                transformOrigin: 'top center',
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--accent-brass)',
              }}
              className="relative z-10 w-full max-w-lg border p-6 space-y-4 shadow-2xl"
            >
              <CornerOrnament position="tl" />
              <CornerOrnament position="tr" />
              <CornerOrnament position="bl" />
              <CornerOrnament position="br" />

              <div className="flex items-start justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded border flex items-center justify-center"
                    style={{
                      borderColor: 'var(--accent-brass)',
                      backgroundColor: 'var(--burgundy-wash)',
                      color: 'var(--accent-primary)',
                    }}
                  >
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                      Editorial Dramaturgy · Gemini AI
                    </span>
                    <h3 className="font-display text-xl font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                      Weave Constellation from Manuscript
                    </h3>
                  </div>
                </div>
                {!isGeneratingStory && (
                  <button
                    type="button"
                    onClick={() => setIsStoryGenOpen(false)}
                    className="p-1 text-[var(--text-muted)] hover:opacity-70 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-3.5 text-xs font-manuscript leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                <p>
                  Analyze your novel chapters and synopsis to extract character personae, psychological motivations,
                  and deep relational tensions (alliances, secret debts, rivalries) into a connected directed constellation.
                </p>

                <div>
                  <label className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Select Volume to Analyze
                  </label>
                  <select
                    value={storyGenProjectId}
                    onChange={(e) => setStoryGenProjectId(e.target.value)}
                    disabled={isGeneratingStory}
                    className="w-full px-3 py-2 text-xs font-manuscript border focus:outline-none cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="text-black">
                        {p.title} ({p.genre})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 border rounded-xs bg-[var(--bg-canvas)] space-y-1" style={{ borderColor: 'var(--border-hairline)' }}>
                  <span className="small-caps-meta text-[11px] block" style={{ color: 'var(--accent-brass)' }}>
                    Manuscript Synopsis:
                  </span>
                  <p className="italic text-[11px] line-clamp-3">
                    “{projectMap.get(storyGenProjectId)?.synopsis || 'No synopsis recorded.'}”
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={storyGenReplace}
                    onChange={(e) => setStoryGenReplace(e.target.checked)}
                    disabled={isGeneratingStory}
                    className="rounded text-[var(--accent-primary)] cursor-pointer"
                  />
                  <span>Replace existing characters in this volume (re-weave fresh constellation)</span>
                </label>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2.5" style={{ borderColor: 'var(--border-hairline)' }}>
                {!isGeneratingStory && (
                  <button
                    type="button"
                    onClick={() => setIsStoryGenOpen(false)}
                    className="px-3.5 py-1.5 text-xs font-manuscript italic cursor-pointer"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  disabled={isGeneratingStory}
                  onClick={async () => {
                    await onAutoGenerateFromStory(storyGenProjectId, storyGenReplace);
                    setIsStoryGenOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-manuscript rounded-xs cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center gap-2 shadow-xs"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#F4EFE5',
                  }}
                >
                  {isGeneratingStory ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>Weaving Constellation...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Generate Constellation</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          DIALOG 3: CONNECT CAST / INSCRIBE RELATION ARROW
         ===================================================================== */}
      <AnimatePresence>
        {isConnectOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConnectOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
            />

            <motion.div
              initial={{ opacity: 0, scaleY: 0.88, rotateX: -12 }}
              animate={{ opacity: 1, scaleY: 1, rotateX: 0 }}
              exit={{ opacity: 0, scaleY: 0.9, rotateX: -8 }}
              transition={{ duration: 0.3 }}
              style={{
                transformOrigin: 'top center',
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-brass)',
              }}
              className="relative z-10 w-full max-w-lg border p-6 space-y-4 shadow-2xl"
            >
              <CornerOrnament position="tl" />
              <CornerOrnament position="tr" />
              <CornerOrnament position="bl" />
              <CornerOrnament position="br" />

              <div className="flex items-start justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
                <div>
                  <span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                    Cast Dynamics · Directed Arrow
                  </span>
                  <h3 className="font-display text-xl font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    Inscribe Relationship Arrow
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConnectOpen(false)}
                  className="p-1 text-[var(--text-muted)] hover:opacity-70 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5 text-sm font-manuscript">
                <div>
                  <label className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Origin Character (From)
                  </label>
                  <select
                    value={connectSourceId}
                    onChange={(e) => setConnectSourceId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-manuscript border focus:outline-none cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {allCharacters.map((c) => (
                      <option key={c.id} value={c.id} className="text-black">
                        {c.name} ({c.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Arrow Relationship Name
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    {[
                      'Uneasy Ally',
                      'Rival',
                      'Protégé',
                      'Mentor',
                      'Confidant',
                      'Sibling',
                      'Secret Debtor',
                      'Betrothed',
                      'Nemesis',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setConnectType(preset);
                          setConnectCustomLabel(preset);
                        }}
                        className={`px-2 py-1 text-xs border rounded-xs transition-colors cursor-pointer text-center truncate ${
                          connectCustomLabel === preset
                            ? 'bg-[var(--accent-primary)] text-[#F4EFE5] border-[var(--accent-primary)]'
                            : 'border-[var(--border-hairline)] hover:bg-[var(--burgundy-wash)]'
                        }`}
                        style={{ color: connectCustomLabel === preset ? '#F4EFE5' : 'var(--text-primary)' }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={connectCustomLabel}
                    onChange={(e) => setConnectCustomLabel(e.target.value)}
                    placeholder="Or type custom (e.g. Reluctant accomplice, Blood brother)"
                    className="w-full px-3 py-1.5 text-xs font-manuscript border focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div>
                  <label className="block small-caps-meta text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Target Character (To)
                  </label>
                  <select
                    value={connectTargetId}
                    onChange={(e) => setConnectTargetId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-manuscript border focus:outline-none cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {allCharacters
                      .filter((c) => c.id !== connectSourceId)
                      .map((c) => (
                        <option key={c.id} value={c.id} className="text-black">
                          {c.name} ({c.role})
                        </option>
                      ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs">
                  <input
                    type="checkbox"
                    checked={connectIsBidirectional}
                    onChange={(e) => setConnectIsBidirectional(e.target.checked)}
                    className="rounded text-[var(--accent-primary)] cursor-pointer"
                  />
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Bidirectional link (inscribe mutually into both character dossiers)
                  </span>
                </label>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2.5" style={{ borderColor: 'var(--border-hairline)' }}>
                <button
                  type="button"
                  onClick={() => setIsConnectOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-manuscript italic cursor-pointer"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveConnection}
                  disabled={!connectSourceId || !connectTargetId || connectSourceId === connectTargetId}
                  className="px-4 py-1.5 text-xs font-manuscript rounded-xs cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#F4EFE5',
                  }}
                >
                  Draw Directed Arrow
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
