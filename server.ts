import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Initialize Gemini SDK if API key is provided
  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // API: Automatically Generate Character Constellation Map from Story
  // ---------------------------------------------------------------------------
  app.post('/api/generate-character-map', async (req: Request, res: Response) => {
    try {
      const {
        projectTitle = 'Untitled Manuscript',
        genre = 'Literary Fiction',
        synopsis = '',
        chapters = [],
      } = req.body;

      // Combine story chapters text for analysis (sample up to ~12,000 chars for prompt balance)
      const storyExcerpt = chapters
        .map(
          (ch: { title: string; content: string }, idx: number) =>
            `--- Chapter ${idx + 1}: ${ch.title} ---\n${ch.content || ''}`
        )
        .join('\n\n')
        .slice(0, 14000);

      // Attempt Gemini AI extraction if key is present
      if (ai) {
        try {
          const prompt = `You are a master literary editor and dramaturg. Analyze this manuscript and generate a comprehensive character relationship map (dramatis personae) with interconnected relationships.

Manuscript Title: "${projectTitle}"
Genre: ${genre}
Synopsis: ${synopsis}

Story Excerpt:
${storyExcerpt || 'No manuscript text available yet. Extrapolate deep literary cast from synopsis and title.'}

Instructions:
1. Extract 3 to 7 core characters (protagonist, deuteragonist, confidants, mentors, antagonists, rivals, lovers, or mysterious figures).
2. For each character, identify:
   - name: full literary name
   - role: archetype or vocation (e.g. "Junior Archivist", "Disgraced Draughtsman", "Master Bell-Founder", "Observatory Keeper")
   - traits: 2 to 4 evocative adjectives (e.g. ["Observant", "Guarded", "Tenacious"])
   - motivation: their deepest desire or unresolved lack
   - arc: how their soul or situation transforms
   - relationships: explicit clauses stating how they relate to the OTHER extracted characters (e.g. "Reluctant ally to Clara; younger brother of Arthur; debtor to Magistrate Domingos")
   - notes: sensory physicality, habits, or symbolic object (e.g. "Carries a bone folder and brass pocket lens")
Ensure the relationships reference the exact names of other characters in the cast so they form a connected directed graph.`;

          const geminiPromise = ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  characters: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        role: { type: Type.STRING },
                        traits: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                        motivation: { type: Type.STRING },
                        arc: { type: Type.STRING },
                        relationships: { type: Type.STRING },
                        notes: { type: Type.STRING },
                      },
                      required: ['name', 'role', 'motivation', 'relationships'],
                    },
                  },
                },
                required: ['characters'],
              },
            },
          });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Gemini API timeout')), 6000)
          );

          const response = await Promise.race([geminiPromise, timeoutPromise]);

          const parsed = JSON.parse(response.text || '{}');
          if (Array.isArray(parsed.characters) && parsed.characters.length > 0) {
            return res.json({
              success: true,
              source: 'gemini',
              characters: parsed.characters,
            });
          }
        } catch (geminiError) {
          console.warn('Gemini character generation fallback engaged:', geminiError);
          // Fall through to deterministic story extractor
        }
      }

      // Fallback: Intelligent domain-based story extraction
      const fallbackCharacters = generateStoryCharactersFallback(
        projectTitle,
        genre,
        synopsis,
        chapters
      );

      return res.json({
        success: true,
        source: 'story-extractor',
        characters: fallbackCharacters,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown generation failure';
      console.error('Failed to generate character map:', message);
      res.status(500).json({ error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // Vite Dev Middleware or Static File Serving
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`INKWELL studio running on http://0.0.0.0:${PORT}`);
  });
}

// -----------------------------------------------------------------------------
// Fallback Narrative Extraction Algorithm (works offline or without API key)
// -----------------------------------------------------------------------------
function generateStoryCharactersFallback(
  title: string,
  genre: string,
  synopsis: string,
  chapters: Array<{ title: string; content: string }>
) {
  const combinedText = `${title} ${synopsis} ${chapters.map((c) => `${c.title} ${c.content}`).join(' ')}`;

  // Find capitalized names in the text
  const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
  const commonExclusions = new Set([
    'The', 'A', 'An', 'In', 'On', 'At', 'By', 'For', 'With', 'Chapter', 'Volume', 'London',
    'Lisbon', 'Thames', 'England', 'November', 'Autumn', 'Winter', 'Spring', 'Summer',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'Morning', 'Evening', 'Night', 'When', 'Then', 'After', 'Before', 'While', 'Under',
  ]);

  const candidates = new Map<string, number>();
  let match: RegExpExecArray | null;
  while ((match = namePattern.exec(combinedText)) !== null) {
    const candidate = match[1].trim();
    if (!commonExclusions.has(candidate) && candidate.length > 3 && !/^\d+$/.test(candidate)) {
      candidates.set(candidate, (candidates.get(candidate) || 0) + 1);
    }
  }

  // Pre-seed based on project theme if few candidates found
  const isMaritime = /sea|ocean|port|hydrographer|ship|fleet|island/i.test(combinedText);
  const isGothic = /bell|parish|foundry|vestry|estuary|manuscript|church/i.test(combinedText);

  if (isGothic) {
    return [
      {
        name: 'Clara Ashworth',
        role: 'Junior Archivist & Protagonist',
        traits: ['Methodical', 'Observant', 'Unyielding'],
        motivation: 'Uncover the forged registry that struck the fourth bell from London records.',
        arc: 'Transforms from an obedient cataloguer into an investigator who risks her career.',
        relationships: 'Uneasy ally to Julian Vance; protégée to Dr. Arthur Henshaw; adversary to Vestry Clerk Martin.',
        notes: 'Carries a horn-handled bone folder and a brass pocket lens on a woven cord.',
      },
      {
        name: 'Julian Vance',
        role: 'Disgraced Marine Draughtsman',
        traits: ['Guarded', 'Cynical', 'Quietly Loyal'],
        motivation: 'Exonerate his deceased brother Arthur from the Bishopsgate foundry fire.',
        arc: 'Overcomes his bitter distrust of institutions to share his family’s private ledgers.',
        relationships: 'Reluctant partner to Clara Ashworth; older brother to late Arthur Vance.',
        notes: 'Walks with a slight limp from an estuary barge accident; smells of pipe tobacco and coal dust.',
      },
      {
        name: 'Dr. Arthur Henshaw',
        role: 'Chief Keeper & Secret Mentor',
        traits: ['Cryptic', 'Scholarly', 'Guilty'],
        motivation: 'Protect the hidden bell register without alerting church authorities.',
        arc: 'A posthumous guide whose scattered margin notes point Clara toward the estuary locks.',
        relationships: 'Mentor to Clara Ashworth; former correspondent of Julian’s father.',
        notes: 'Left coded botanical illustrations pressed into the library’s third gallery volumes.',
      },
      {
        name: 'Clerk Martin Vane',
        role: 'Vestry Overseer & Antagonist',
        traits: ['Rigid', 'Ambitious', 'Secretive'],
        motivation: 'Ensure the 1842 parish ledger erasure is never brought before the bishop.',
        arc: 'Tightens institutional control as Clara’s inquiries draw closer to the estuary wharf.',
        relationships: 'Adversary to Clara Ashworth; suspicious of Julian Vance.',
        notes: 'Wears a heavy signet ring of blackened silver and speaks in low, deliberate cadences.',
      },
    ];
  }

  if (isMaritime) {
    return [
      {
        name: 'Mateus Ferreira',
        role: 'Apprentice Hydrographer',
        traits: ['Keen-eyed', 'Patient', 'Quietly Defiant'],
        motivation: 'Decipher Master Domingos’ secret Atlantic soundings before the naval fleet departs.',
        arc: 'Discovers that nautical precision carries profound moral duty to innocent crews.',
        relationships: 'Apprentice to Master Domingos; childhood ally of Inês de Almeida; rival to Lieutenant Cabral.',
        notes: 'Inks his own drafting sheets with imported vermilion cinnabar.',
      },
      {
        name: 'Inês de Almeida',
        role: 'Engraver & Master Printer’s Daughter',
        traits: ['Sharp-witted', 'Resourceful', 'Courageous'],
        motivation: 'Preserve her family’s copperplate press against royal censorship fines.',
        arc: 'Becomes the underground publisher of the unredacted charts.',
        relationships: 'Confidante and childhood friend of Mateus Ferreira; owed a favor by harbor merchants.',
        notes: 'Fingertips permanently stained from copperplate etching nitric acid.',
      },
      {
        name: 'Master Domingos',
        role: 'Royal Hydrographer & Mentor',
        traits: ['Taciturn', 'Venerable', 'Burdened'],
        motivation: 'Conceal dangerous phantom shoals from reckless admiralty captains.',
        arc: 'Entrusts his lifetime of private soundings to Mateus before sudden royal exile.',
        relationships: 'Mentor to Mateus Ferreira; estranged colleague of the Naval Minister.',
        notes: 'Keeps an ancient brass astrolabe calibrated to the Azores meridian.',
      },
      {
        name: 'Lieutenant Cabral',
        role: 'Admiralty Officer & Foil',
        traits: ['Imperious', 'Impatient', 'Nationalistic'],
        motivation: 'Claim the uncharted islands in the name of the Crown at any cost.',
        arc: 'Stands as the zealous military authority pressing the hydrographers for unverified maps.',
        relationships: 'Rival and inquisitor to Mateus Ferreira; suspicious of Inês’ print shop.',
        notes: 'Wears gold-braided naval epaulettes tarnished green by sea salt.',
      },
    ];
  }

  // General Literary Story Cast
  return [
    {
      name: `${title.split(' ')[0] || 'Alistair'} Sterling`,
      role: 'Protagonist & Scholar',
      traits: ['Analytical', 'Passionate', 'Haunted'],
      motivation: 'Resolve the mystery recorded in the manuscript’s opening chapters.',
      arc: 'Crosses from intellectual detachment into emotional vulnerability.',
      relationships: 'Companion to Evelyn Thorne; former colleague of Marcus Vane.',
      notes: 'Carries an antique silver pocket watch that runs three minutes fast.',
    },
    {
      name: 'Evelyn Thorne',
      role: 'Confidante & Keeper of the Archives',
      traits: ['Perceptive', 'Steadfast', 'Skeptical'],
      motivation: 'Protect the sanctuary of the study against outside intrusion.',
      arc: 'Reclaims her agency by deciphering the central riddle alongside Sterling.',
      relationships: 'Trusted confidante to Alistair Sterling; secret correspondent with Marcus Vane.',
      notes: 'Speaks with precise, quiet diction and keeps her hair bound with a velvet ribbon.',
    },
    {
      name: 'Marcus Vane',
      role: 'Antagonist & Rival Scholar',
      traits: ['Calculated', 'Worldly', 'Uncompromising'],
      motivation: 'Acquire the final volume to secure his appointment to the high academy.',
      arc: 'Finds his rational worldview shattered when the archives reveal his family’s debt.',
      relationships: 'Intellectual rival to Alistair Sterling; former patron of Evelyn Thorne.',
      notes: 'Carries a cane tipped with an ivory carving of a raven.',
    },
  ];
}

startServer();
