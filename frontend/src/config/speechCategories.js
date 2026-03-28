/**
 * PHRASE_SETS is the single source of truth for all phrase content.
 *
 * Phrase fields:
 *   id         — unique string key
 *   text       — the phrase the user is asked to say
 *   difficulty — 'easy' | 'medium' | 'hard'
 *   enabled    — false = phrase exists but is excluded from active sessions
 */
export const PHRASE_SETS = {
  commonPhrases: [
    { id: 'hello',        text: 'Hello',         difficulty: 'easy',   enabled: true },
    { id: 'thank-you',   text: 'Thank you',      difficulty: 'easy',   enabled: true },
    { id: 'good-morning', text: 'Good morning',  difficulty: 'easy',   enabled: true },
    { id: 'i-am-okay',   text: 'I am okay',      difficulty: 'easy',   enabled: true },
    { id: 'i-need-help', text: 'I need help',    difficulty: 'medium', enabled: true },
    { id: 'water-please', text: 'Water please',  difficulty: 'medium', enabled: true },
  ],
  dailyConversation: [],
  articulationDrills: [],
};

/**
 * SPEECH_CATEGORIES defines the category cards shown in Speech Practice Mode.
 *
 * Category fields:
 *   id          — matches a key in PHRASE_SETS
 *   label       — display name shown on the category card
 *   description — brief explanation shown on the card
 *   enabled     — false = card is visible but not selectable (shows "Coming Soon")
 */
export const SPEECH_CATEGORIES = [
  {
    id: 'commonPhrases',
    label: 'Common Phrases',
    description: 'Everyday phrases for greetings, needs, and short responses.',
    enabled: true,
  },
  {
    id: 'dailyConversation',
    label: 'Daily Conversation',
    description: 'Short conversational exchanges for everyday situations.',
    enabled: false,
  },
  {
    id: 'articulationDrills',
    label: 'Articulation Drills',
    description: 'Targeted exercises to strengthen specific sounds.',
    enabled: false,
  },
];

/**
 * Returns the phrase list for a given category id.
 * Returns only enabled phrases.
 */
export function getPhrasesForCategory(categoryId) {
  const phrases = PHRASE_SETS[categoryId] ?? [];
  return phrases.filter((p) => p.enabled);
}
