import { AIProviderError, type AIErrorCode } from './types';

export function normalizeAIError(error: unknown): AIProviderError {
  if (error instanceof AIProviderError) return error;
  const message = error instanceof Error ? error.message : String(error || 'AI request failed');
  const lower = message.toLowerCase();
  const statusMatch = lower.match(/\b(401|403|404|408|429|500|502|503|504)\b/);
  if (statusMatch) return errorFromStatus(Number(statusMatch[1]), lower);
  if (lower.includes('abort') || lower.includes('timeout')) {
    return new AIProviderError('timeout', 'The AI provider took too long to respond. Please try again.');
  }
  return new AIProviderError('provider_unavailable', 'The AI provider is temporarily unavailable. Please try again.');
}

export function errorFromStatus(status: number, body = ''): AIProviderError {
  const lower = body.toLowerCase();
  let code: AIErrorCode = 'provider_unavailable';
  let message = 'The AI provider is temporarily unavailable. Please try again.';
  if (status === 401 || status === 403 || lower.includes('invalid api key') || lower.includes('unauthorized')) {
    code = 'bad_key';
    message = 'That AI key was rejected. Check it and try again.';
  } else if (status === 404 || lower.includes('model')) {
    code = 'model_unavailable';
    message = 'That AI model is unavailable. Choose another model.';
  } else if (status === 408 || status === 504) {
    code = 'timeout';
    message = 'The AI provider timed out. Please try again.';
  } else if (status === 429) {
    code = 'rate_limit';
    message = 'Free models are rate-limited. Try another model or try again shortly.';
  }
  return new AIProviderError(code, message, status);
}

export function timeoutSignal(timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cleanup: () => clearTimeout(timer) };
}
