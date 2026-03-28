export const APP_NAME = 'Echo';
export const APP_TAGLINE = 'Your At-Home Stroke Recovery Coach';

export const ROUTES = {
  HOME:          '/',
  FACIAL_EXERCISE: '/facial-exercise',
  ARM_MOVEMENT:  '/arm-movement',
  HAND_RECOVERY: '/hand-recovery',
  FULL_SESSION:  '/full-session',
  SUMMARY:       '/summary',
};

/**
 * Top-level navigation items shown on the Home screen.
 * Adding a new mode means adding an entry here — no page edits required.
 */
export const MODE_CARDS = [
  {
    id:          'facial-recovery',
    label:       'Facial Recovery',
    description: 'Practice smile and eyebrow movements with live symmetry feedback.',
    route:       ROUTES.FACIAL_EXERCISE,
    enabled:     true,
  },
  {
    id:          'arm-movement',
    label:       'Arm Movement',
    description: 'Build arm strength and range of motion with guided lifting exercises.',
    route:       ROUTES.ARM_MOVEMENT,
    enabled:     true,
  },
  {
    id:          'hand-recovery',
    label:       'Hand Recovery',
    description: 'Improve hand and finger control with open, close, and hold exercises.',
    route:       ROUTES.HAND_RECOVERY,
    enabled:     true,
  },
  {
    id:          'full-session',
    label:       'Full Session',
    description: 'A guided sequence combining facial, arm, and hand exercises in one session.',
    route:       ROUTES.FULL_SESSION,
    enabled:     true,
  },
];
