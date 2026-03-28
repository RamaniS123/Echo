export const APP_NAME = 'Echo';
export const APP_TAGLINE = 'Guided Stroke Recovery Practice';

export const ROUTES = {
  HOME: '/',
  FACIAL_EXERCISE: '/facial-exercise',
  SPEECH_PRACTICE: '/speech-practice',
  SUMMARY: '/summary',
};

/**
 * Top-level navigation items shown on the Home screen.
 * Adding a new mode means adding an entry here — no page edits required.
 */
export const MODE_CARDS = [
  {
    id: 'facial-exercise',
    label: 'Facial Exercise Mode',
    description: 'Practice smile, eye, and eyebrow movements with live feedback.',
    route: ROUTES.FACIAL_EXERCISE,
    enabled: true,
  },
  {
    id: 'speech-practice',
    label: 'Speech Practice Mode',
    description: 'Practice common phrases and daily conversation at your own pace.',
    route: ROUTES.SPEECH_PRACTICE,
    enabled: true,
  },
];
