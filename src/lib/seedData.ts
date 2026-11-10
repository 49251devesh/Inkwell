import { InkwellStoreData, LiteraryEpigraph } from '../types/inkwell';
import { countWords } from './formatters';

export const LITERARY_EPIGRAPHS: LiteraryEpigraph[] = [
  {
    quote:
      'A room of one’s own is not silence alone; it is the quiet permission for a sentence to find its gravity.',
    author: 'Eleanor Vance',
    work: 'Notebooks on Craft',
  },
  {
    quote:
      'The universe (which others call the Library) is composed of an indefinite and perhaps infinite number of hexagonal galleries.',
    author: 'Jorge Luis Borges',
    work: 'The Library of Babel',
  },
  {
    quote:
      'Write as if you were the only person left in the city, with one lamp burning and three hours until dawn.',
    author: 'Rainer Maria Rilke',
    work: 'Letters to a Young Poet',
  },
  {
    quote:
      'If there is a book that you want to read, but it hasn’t been written yet, then you must write it.',
    author: 'Toni Morrison',
    work: 'Ohioana Address',
  },
  {
    quote:
      'Words are events; they do things, change things. They transform both speaker and hearer.',
    author: 'Ursula K. Le Guin',
    work: 'The Wave in the Mind',
  },
];

export function getDailyEpigraph(): LiteraryEpigraph {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  return LITERARY_EPIGRAPHS[dayOfYear % LITERARY_EPIGRAPHS.length];
}

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString();
const dateStrDaysAgo = (d: number) =>
  new Date(now - d * 86400000).toISOString().slice(0, 10);

const ch1Prose = `Rain had been falling over the glass roof of the Aldershot Conservatory since four o’clock, turning the iron ribs black and blurring the city lamps below into amber smudges. Clara set her brass calipers beside the ledgers and listened to the slow metronome of water dripping from the fern fronds onto the marble tiles.

No one came up to the third gallery after dusk, which was precisely why the archivist kept his uncatalogued folios there. Bound in cracked calfskin and tied with faded linen tape, the volumes smelled faintly of cedarwood, damp wool, and the iron-gall ink that had eaten tiny pinholes through their marginalia over two centuries.

She turned the vellum leaf with the flat of her thumb. Between the pressed stem of an alpine gentian and a surveyor’s sketch of the tidal marshes, someone had written a single line in a hurried, upright hand: Do not trust the bell-foundry’s ledger; the fourth bell was cast in silence.`;

const ch2Prose = `By nine the next morning the mist had lifted off the estuary, leaving the slate roofs of Lower Wharf gleaming like wet mussel shells. Julian waited by the stone bollard with his coat collar turned up, watching the mail packet nose through the lock gates.

"You brought the rubbing?" he asked before Clara had even reached the cobbles.

"And the surveyor’s margin notes," she replied, tapping the oilskin satchel strapped across her shoulder. "Whatever your brother found beneath the old nave, someone paid a clerk forty guineas in 1842 to strike the entry from the parish register."`;

const ch3Prose = `The bell-foundry smelled of tallow, cold ash, and damp brick. Long after the furnaces had been bricked shut, the soot clung to the rafters in velvet stalactites that shivered whenever a tram rattled down Bishopsgate.

Clara held the tallow lamp close to the brickwork beneath the casting pit. Scratch marks—deliberate, measured in Roman numerals rather than Arabic digits—ran along the mortar course at waist height, ending abruptly behind a rusted iron flue.`;

const ch4Prose = `In the Cartographer’s House above Lisbon, every map was drawn twice: once for the Admiralty, with soundings and shoals marked in vermilion ink, and once for the family archive, where the blank parchment at the edges recorded what the captains refused to swear to under oath.

Mateus leaned over the mahogany table, weighting the curling corners of the Azores chart with four river stones. Outside the shuttered casement, the Tagus ran grey as pewter under a low Atlantic squall.`;

const ch5Prose = `The letter arrived without postage, slipped beneath the courtyard door sometime between the baker’s cart and the first bell of Santa Catarina. Its paper was thick rag cotton, deckle-edged on all four sides, and the wax seal bore no crest—only the impression of an ordinary brass thimble.`;

const ch6Prose = `Winter came early to the observatory at Greymoor. By mid-November, frost feathered the inside of the brass telescope housing each morning, and the ink in Thomas’s desk well froze solid unless he kept a small oil warmer burning beside the blotter.

He logged the occultation at 02:14 GMT, his fingers stiff inside fingerless woollen mittens, unaware that the telegram already sitting in the stationmaster’s pocket three miles down the valley would end thirty years of quiet solitude.`;

export function createSeedData(): InkwellStoreData {
  const chapters = [
    {
      id: 'ch-glass-1',
      projectId: 'proj-conservatory',
      order: 1,
      title: 'The Third Gallery',
      content: ch1Prose,
      notes: 'Establish the sensory atmosphere of the conservatory and introduce the uncatalogued folio.',
      wordCount: countWords(ch1Prose),
      updatedAt: hoursAgo(26),
    },
    {
      id: 'ch-glass-2',
      projectId: 'proj-conservatory',
      order: 2,
      title: 'Lower Wharf at Nine',
      content: ch2Prose,
      notes: 'Clara meets Julian; reveal the missing forty-guinea parish register entry.',
      wordCount: countWords(ch2Prose),
      updatedAt: hoursAgo(14),
    },
    {
      id: 'ch-glass-3',
      projectId: 'proj-conservatory',
      order: 3,
      title: 'The Casting Pit',
      content: ch3Prose,
      notes: 'Inspection of the bricked foundry beneath Bishopsgate.',
      wordCount: countWords(ch3Prose),
      updatedAt: hoursAgo(2),
    },
    {
      id: 'ch-cartographer-1',
      projectId: 'proj-cartographer',
      order: 1,
      title: 'Two Charts for the Admiralty',
      content: ch4Prose,
      notes: 'Introduce Mateus and the dual-ledger cartography tradition.',
      wordCount: countWords(ch4Prose),
      updatedAt: daysAgo(3),
    },
    {
      id: 'ch-cartographer-2',
      projectId: 'proj-cartographer',
      order: 2,
      title: 'The Thimble Seal',
      content: ch5Prose,
      notes: 'Arrival of the unposted cotton-rag letter.',
      wordCount: countWords(ch5Prose),
      updatedAt: daysAgo(2),
    },
    {
      id: 'ch-greymoor-1',
      projectId: 'proj-greymoor',
      order: 1,
      title: 'Frost on the Brass Housing',
      content: ch6Prose,
      notes: 'Opening scene at Greymoor Observatory before the telegram arrives.',
      wordCount: countWords(ch6Prose),
      updatedAt: daysAgo(6),
    },
  ];

  return {
    version: 1,
    projects: [
      {
        id: 'proj-conservatory',
        title: 'The Glass Conservatory',
        subtitle: 'A Novel of Victorian Archives & Lost Bells',
        author: 'A. S. Blackwood',
        genre: 'Literary Mystery',
        synopsis:
          'When an archivist uncovers a forged 1842 parish ledger hidden inside a botanical folio, she and a disgraced bell-founder’s brother trace a vanished fourth church bell through London’s fog-bound estuaries.',
        coverPalette: 'burgundy-morocco',
        wordGoal: 85000,
        createdAt: daysAgo(42),
        updatedAt: hoursAgo(2),
        lastOpenedChapterId: 'ch-glass-3',
      },
      {
        id: 'proj-cartographer',
        title: 'The Soundings of Lisbon',
        subtitle: 'Private Charts of the Atlantic Fleet',
        author: 'A. S. Blackwood',
        genre: 'Historical Fiction',
        synopsis:
          'Along the steep alleys above the Tagus in 1754, a royal hydrographer’s apprentice discovers that his master’s secret family charts record islands that vanish whenever the Admiralty sends ships to claim them.',
        coverPalette: 'midnight-indigo',
        wordGoal: 92000,
        createdAt: daysAgo(74),
        updatedAt: daysAgo(2),
        lastOpenedChapterId: 'ch-cartographer-2',
      },
      {
        id: 'proj-greymoor',
        title: 'Winter at Greymoor',
        subtitle: 'Chronicles of a Northern Observatory',
        author: 'A. S. Blackwood',
        genre: 'Speculative Pastoral',
        synopsis:
          'An aging astronomer stationed on a windswept Scottish moor records three inexplicable seconds of darkness across the northern sky—and finds the parish clocks three miles away stopped at the same instant.',
        coverPalette: 'forest-buckram',
        wordGoal: 68000,
        createdAt: daysAgo(110),
        updatedAt: daysAgo(6),
        lastOpenedChapterId: 'ch-greymoor-1',
      },
    ],
    chapters,
    characters: [
      {
        id: 'char-clara',
        projectId: 'proj-conservatory',
        name: 'Clara Ashworth',
        role: 'Junior Archivist',
        traits: ['Observant', 'Methodical', 'Stubbornly curious'],
        motivation: 'Restore the true provenance of her late mentor’s uncatalogued folios.',
        arc: 'Moves from cautious caretaker of dead paper to active investigator risking her post.',
        relationships: 'Uneasy ally to Julian; protégée of the late Dr. Henshaw.',
        notes: 'Always carries a bone folder and a pocket lens on a brass chain.',
      },
      {
        id: 'char-julian',
        projectId: 'proj-conservatory',
        name: 'Julian Vance',
        role: 'Former Marine Draughtsman',
        traits: ['Guarded', 'Dry-humored', 'Perceptive'],
        motivation: 'Clear his brother’s name after the Bishopsgate foundry collapse.',
        arc: 'Learns to trust Clara with the foundry’s remaining private correspondence.',
        relationships: 'Older brother to Arthur Vance; reluctant partner to Clara.',
        notes: 'Walks with a slight limp from an estuary barge accident.',
      },
      {
        id: 'char-henshaw',
        projectId: 'proj-conservatory',
        name: 'Dr. Arthur Henshaw',
        role: 'Chief Keeper (Deceased)',
        traits: ['Cryptic', 'Generous', 'Secretive'],
        motivation: 'Preserve evidence of the fourth bell without alerting the vestry.',
        arc: 'Presence felt through marginalia, pressed flora, and coded shelf marks.',
        relationships: 'Mentor to Clara; corresponded secretly with the foundry.',
        notes: 'Left three books intentionally mis-shelved in the third gallery.',
      },
      {
        id: 'char-mateus',
        projectId: 'proj-cartographer',
        name: 'Mateus Ferreira',
        role: 'Apprentice Hydrographer',
        traits: ['Patient', 'Quietly ambitious', 'Keen-eyed'],
        motivation: 'Earn his master’s cipher key before the autumn fleet sails.',
        arc: 'Discovers his reverence for precision hides a deeper moral duty to the sailors.',
        relationships: 'Apprentice to Master Domingos; childhood friend of Inês.',
        notes: 'Mixes his own vermilion pigment from cinnabar and gum arabic.',
      },
      {
        id: 'char-ines',
        projectId: 'proj-cartographer',
        name: 'Inês de Almeida',
        role: 'Printer’s Daughter & Engraver',
        traits: ['Sharp-tongued', 'Resourceful', 'Brave'],
        motivation: 'Keep her father’s copperplate press solvent after censorship fines.',
        arc: 'Becomes the quiet publisher of the unredacted Atlantic folios.',
        relationships: 'Confidante to Mateus; owed a debt by the port magistrate.',
        notes: 'Stained fingertips from copperplate etching acid.',
      },
      {
        id: 'char-thomas',
        projectId: 'proj-greymoor',
        name: 'Thomas McAllister',
        role: 'Observatory Keeper',
        traits: ['Solitary', 'Punctual', 'Haunted'],
        motivation: 'Account for the missing three seconds in his transit logbook.',
        arc: 'Confronts the town below the moor after thirty years of self-exile.',
        relationships: 'Estranged cousin of the Greymoor stationmaster.',
        notes: 'Keeps a pocket chronometer wound to Greenwich time.',
      },
    ],
    locations: [
      {
        id: 'loc-conservatory',
        projectId: 'proj-conservatory',
        name: 'Aldershot Conservatory',
        region: 'Bloomsbury North',
        atmosphere: 'Damp glass, cedarwood shelves, distant rain on ironwork',
        description:
          'A Victorian botanical hall whose upper iron gallery houses uncatalogued parish manuscripts.',
        mapX: 34,
        mapY: 38,
      },
      {
        id: 'loc-wharf',
        projectId: 'proj-conservatory',
        name: 'Lower Wharf & Lock Gates',
        region: 'Thames Estuary',
        atmosphere: 'Brine, coal smoke, wet slate and gull cries',
        description:
          'Tidal timber quay where the morning mail packet docks beside old Customs sheds.',
        mapX: 68,
        mapY: 64,
      },
      {
        id: 'loc-tagus',
        projectId: 'proj-cartographer',
        name: 'The Cartographer’s House',
        region: 'Alfama Ridge, Lisbon',
        atmosphere: 'Sun-bleached lime plaster, Atlantic salt, linseed oil',
        description:
          'Three-story stone residence overlooking the Tagus anchorage with north-lit drafting rooms.',
        mapX: 48,
        mapY: 52,
      },
    ],
    lore: [
      {
        id: 'lore-fourth-bell',
        projectId: 'proj-conservatory',
        title: 'The Ordinance of the Fourth Bell',
        category: 'Civic Custom',
        summary:
          'St. Jude’s steeple was licensed for four bronze bells in 1791, yet only three appear in any post-1842 inventory.',
      },
      {
        id: 'lore-dual-charts',
        projectId: 'proj-cartographer',
        title: 'The Admiralty & Family Ledgers',
        category: 'Guild Tradition',
        summary:
          'Master hydrographers kept two copies of hazardous shoal surveys to protect crews from reckless political expeditions.',
      },
    ],
    timeline: [
      {
        id: 'tl-1',
        projectId: 'proj-conservatory',
        era: 'Autumn 1842',
        title: 'The Vestry Register Erasure',
        description: 'Forty guineas paid to an unnamed clerk to strike the fourth bell from St. Jude’s inventory.',
        order: 1,
      },
      {
        id: 'tl-2',
        projectId: 'proj-conservatory',
        era: 'November 1889',
        title: 'Discovery in the Third Gallery',
        description: 'Clara Ashworth uncovers Dr. Henshaw’s mis-shelved folio during a night storm.',
        order: 2,
      },
    ],
    sessions: [
      { id: 'sess-1', date: dateStrDaysAgo(6), projectId: 'proj-greymoor', wordsWritten: 640, minutesSpent: 42 },
      { id: 'sess-2', date: dateStrDaysAgo(5), projectId: 'proj-conservatory', wordsWritten: 1120, minutesSpent: 65 },
      { id: 'sess-3', date: dateStrDaysAgo(4), projectId: 'proj-conservatory', wordsWritten: 890, minutesSpent: 50 },
      { id: 'sess-4', date: dateStrDaysAgo(3), projectId: 'proj-cartographer', wordsWritten: 1340, minutesSpent: 78 },
      { id: 'sess-5', date: dateStrDaysAgo(2), projectId: 'proj-cartographer', wordsWritten: 760, minutesSpent: 48 },
      { id: 'sess-6', date: dateStrDaysAgo(1), projectId: 'proj-conservatory', wordsWritten: 1050, minutesSpent: 62 },
      { id: 'sess-7', date: dateStrDaysAgo(0), projectId: 'proj-conservatory', wordsWritten: 580, minutesSpent: 34 },
    ],
    settings: {
      theme: 'daylight',
      authorPenName: 'A. S. Blackwood',
      dailyWordGoal: 1000,
      focusModeEnabled: false,
    },
  };
}
