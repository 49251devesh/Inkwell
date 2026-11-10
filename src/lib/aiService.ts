import { stripHtml } from './formatters';

export type AIActionType =
  | 'continue'
  | 'rewrite'
  | 'tighten'
  | 'describe'
  | 'brainstorm'
  | 'critique';

export interface AIActionMeta {
  id: AIActionType;
  label: string;
  latinTag: string;
  description: string;
  iconName: string;
}

export const AI_ACTIONS: AIActionMeta[] = [
  {
    id: 'continue',
    label: 'Continue',
    latinTag: 'Sequere',
    description: 'Pen the next passage in rhythm with the author’s tone.',
    iconName: 'PenTool',
  },
  {
    id: 'rewrite',
    label: 'Rewrite',
    latinTag: 'Reficere',
    description: 'Elevate prose cadence and recast inert phrasing.',
    iconName: 'Sparkles',
  },
  {
    id: 'tighten',
    label: 'Tighten',
    latinTag: 'Stringere',
    description: 'Prune surplus modifiers and heighten narrative torque.',
    iconName: 'Scissors',
  },
  {
    id: 'describe',
    label: 'Describe',
    latinTag: 'Depingere',
    description: 'Evoke tactile sensations—scents, lighting, textures, sounds.',
    iconName: 'Eye',
  },
  {
    id: 'brainstorm',
    label: 'Brainstorm',
    latinTag: 'Excogitare',
    description: 'Propose three narrative complications or dialogue hooks.',
    iconName: 'Lightbulb',
  },
  {
    id: 'critique',
    label: 'Critique',
    latinTag: 'Iudicare',
    description: 'Appraise pacing, psychological realism, and voice.',
    iconName: 'BookOpenCheck',
  },
];

export interface AIRequest {
  action: AIActionType;
  selectedText?: string;
  contextText: string;
  chapterTitle?: string;
  projectTitle?: string;
  projectGenre?: string;
  customPrompt?: string;
}

export interface AIResponse {
  action: AIActionType;
  headline: string;
  output: string;
  critiquePoints?: string[];
  isDemo: true;
  timestamp: string;
}

/**
 * Single service boundary for editorial AI queries.
 * Currently backed by handcrafted domain prose templates; easily swappable
 * with a server-side Gemini SDK endpoint in future phases.
 */
export async function requestAIAssistance(request: AIRequest): Promise<AIResponse> {
  // Simulate natural quill-drawing latency
  await new Promise((resolve) => setTimeout(resolve, 650));

  const cleanSelection = request.selectedText ? stripHtml(request.selectedText).trim() : '';
  const cleanContext = stripHtml(request.contextText).trim();
  const sampleAnchor = cleanSelection || cleanContext.slice(-240);

  let headline = 'Editorial Margin Note';
  let output = '';
  let critiquePoints: string[] | undefined;

  switch (request.action) {
    case 'continue': {
      headline = 'Continuation of the Folio';
      output =
        'A draft had found its way past the heavy damask curtains, making the lamp flame shiver in its glass chimney. For several seconds neither spoke; the only sound was the patient scratching of rain against the dormer and the quiet settling of coals in the hearth. When at last she turned the page, the margin showed three ink-blots spaced like warning beacons across the year’s earliest entry.';
      break;
    }
    case 'rewrite': {
      headline = 'Elevated Recasting';
      if (cleanSelection) {
        output = `Beneath the leaden glare of noon, the silence hardened. Rather than yielding, each word weighed like unminted silver upon the tongue: ${cleanSelection.replace(/[.]+$/, '')}, as though even the stone lintel above them were keeping tally.`;
      } else {
        output =
          'Rain ceased abruptly at three, leaving Lower Wharf wrapped in a cold river-mist that smelled of wet timber and pitch. The packet’s iron capstan ground once against the stone quay, groaning like an old hinge before falling still.';
      }
      break;
    }
    case 'tighten': {
      headline = 'Pruned & Sharpened Cadence';
      if (cleanSelection) {
        // Cut filler words and sharpen
        const words = cleanSelection.split(/\s+/);
        if (words.length > 8) {
          output = words
            .filter((w) => !/^(very|really|quite|somewhat|suddenly|just|actually|sort\s+of)$/i.test(w))
            .join(' ');
        } else {
          output = cleanSelection.replace(/\b(was looking at)\b/gi, 'watched')
            .replace(/\b(started to walk)\b/gi, 'walked')
            .replace(/\b(felt a feeling of)\b/gi, 'felt');
        }
      } else {
        output =
          'Mist covered the estuary. The mail packet nosed through the lock gates. Julian waited by the bollard with his collar raised.';
      }
      break;
    }
    case 'describe': {
      headline = 'Sensory & Atmospheric Deepening';
      output =
        'The air carried the sharp mineral tang of wet mortar and iron-gall ink. Where the ceiling had wept during the night, dark rings spread across the ceiling plaster like watermarks on rag paper. Cold radiated through the soles of her boots from the flags beneath, accompanied by the faint, rhythmic ticking of a grandfather clock echoing two floors below.';
      break;
    }
    case 'brainstorm': {
      headline = 'Three Narrative Complications';
      output =
        '1. The Unrecorded Cipher: The dates inscribed along the bell casting correspond not to the parish vestry, but to a private admiralty expedition that sailed three months before the fire.\n\n2. The False Key: Julian produces an iron skeleton key found among his brother’s papers, but Clara recognizes the notch pattern as belonging to the Master Archivist’s inner sanctum.\n\n3. The Messenger on the Estuary: A boy arrives with a cedarwood cigar box, delivered not to Clara or Julian, but addressed to the very scholar who died three weeks prior.';
      critiquePoints = [
        'Option 1 introduces political stakes beyond the domestic parish.',
        'Option 2 challenges Julian’s claimed innocence and tests trust.',
        'Option 3 introduces a tangible ticking clock via physical evidence.',
      ];
      break;
    }
    case 'critique': {
      headline = 'Editorial Appraisal';
      output =
        'The opening possesses strong sensory restraint, but examine whether the transition between the observation and the dialogue arrives too quickly. Letting the silence settle between the two characters will allow the historical weight of the ledger to register more powerfully with the reader.';
      critiquePoints = [
        'Atmospheric Grounding: Exceptional tactile details (iron ribs, vellum leaf, tallow smell).',
        'Pacing: Scene shift between chapters can afford one extra beat of quiet reflection before action.',
        'Voice Consistency: Prose cadence feels period-accurate without descending into pastiche.',
      ];
      break;
    }
  }

  return {
    action: request.action,
    headline,
    output,
    critiquePoints,
    isDemo: true,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}
