import { getAIHeaders, providerLabel } from './aiClient';

export type AIActionType = 'continue' | 'rewrite' | 'tighten' | 'describe' | 'brainstorm' | 'critique';
export interface AIActionMeta { id: AIActionType; label: string; latinTag: string; description: string; iconName: string; }
export const AI_ACTIONS: AIActionMeta[] = [
  { id: 'continue', label: 'Continue', latinTag: 'Sequere', description: 'Pen the next passage in rhythm with the author’s tone.', iconName: 'PenTool' },
  { id: 'rewrite', label: 'Rewrite', latinTag: 'Reficere', description: 'Elevate prose cadence and recast inert phrasing.', iconName: 'Sparkles' },
  { id: 'tighten', label: 'Tighten', latinTag: 'Stringere', description: 'Prune surplus modifiers and heighten narrative torque.', iconName: 'Scissors' },
  { id: 'describe', label: 'Describe', latinTag: 'Depingere', description: 'Evoke tactile sensations—scents, lighting, textures, sounds.', iconName: 'Eye' },
  { id: 'brainstorm', label: 'Brainstorm', latinTag: 'Excogitare', description: 'Propose three narrative complications or dialogue hooks.', iconName: 'Lightbulb' },
  { id: 'critique', label: 'Critique', latinTag: 'Iudicare', description: 'Appraise pacing, psychological realism, and voice.', iconName: 'BookOpenCheck' },
];

export interface AIRequest { action: AIActionType; selectedText?: string; contextText: string; chapterTitle?: string; projectTitle?: string; projectGenre?: string; customPrompt?: string; }
export interface AIResponse { action: AIActionType; headline: string; output: string; critiquePoints?: string[]; isDemo: boolean; timestamp: string; provider: string; model: string; }

export async function requestAIAssistance(request: AIRequest): Promise<AIResponse> {
  const response = await fetch('/api/ai/assist', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAIHeaders() }, body: JSON.stringify(request) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The AI provider is temporarily unavailable. Please try again.');
  return data as AIResponse;
}

export { providerLabel };
