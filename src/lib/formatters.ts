import { CoverPalette, CoverPaletteId } from '../types/inkwell';

export const COVER_PALETTES: Record<CoverPaletteId, CoverPalette> = {
  'burgundy-morocco': {
    id: 'burgundy-morocco',
    name: 'Burgundy Morocco',
    clothHex: '#5E2C32',
    spineHex: '#431D22',
    foilHex: '#DFC59B',
    ribbonHex: '#B18A5A',
    accentHex: '#8E4D55',
  },
  'midnight-indigo': {
    id: 'midnight-indigo',
    name: 'Prussian Buckram',
    clothHex: '#253242',
    spineHex: '#18212D',
    foilHex: '#DEC49A',
    ribbonHex: '#8B3E46',
    accentHex: '#3B4E66',
  },
  'forest-buckram': {
    id: 'forest-buckram',
    name: 'Botanical Vellum',
    clothHex: '#2C3F35',
    spineHex: '#1C2A23',
    foilHex: '#D8BE94',
    ribbonHex: '#A65A62',
    accentHex: '#415C4E',
  },
  'ochre-linen': {
    id: 'ochre-linen',
    name: 'Amber Linen',
    clothHex: '#7A5934',
    spineHex: '#583E22',
    foilHex: '#F4EFE5',
    ribbonHex: '#713D43',
    accentHex: '#9A7448',
  },
  'charcoal-calfskin': {
    id: 'charcoal-calfskin',
    name: 'Charcoal Calfskin',
    clothHex: '#2B2925',
    spineHex: '#1C1B18',
    foilHex: '#D4BC98',
    ribbonHex: '#984C54',
    accentHex: '#47433D',
  },
};

export function toRoman(num: number): string {
  if (num <= 0) return 'I';
  const lookup: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let n = Math.floor(num);
  let result = '';
  for (const [val, sym] of lookup) {
    while (n >= val) {
      result += sym;
      n -= val;
    }
  }
  return result;
}

export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(text: string): number {
  const plain = stripHtml(text);
  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}

export function formatWordCount(words: number): string {
  return new Intl.NumberFormat('en-US').format(words);
}

export function formatFolioDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Undated';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 2) return 'Just inked';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function getFirstParagraphExcerpt(content: string, maxChars = 320): string {
  const plain = stripHtml(content);
  if (!plain) {
    return 'The page lies unmarked beneath the brass lamp, awaiting its opening line.';
  }
  if (plain.length <= maxChars) return plain;
  const sliced = plain.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${sliced.slice(0, lastSpace > 120 ? lastSpace : maxChars)}…`;
}

export function getGreetingByHour(): { salutation: string; dateLabel: string } {
  const now = new Date();
  const hour = now.getHours();
  let salutation = 'Morning Study';
  if (hour >= 12 && hour < 17) salutation = 'Afternoon Desk';
  else if (hour >= 17 && hour < 21) salutation = 'Evening Atelier';
  else if (hour >= 21 || hour < 5) salutation = 'Midnight Watch';

  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return { salutation, dateLabel };
}
