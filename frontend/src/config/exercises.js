/**
 * FACIAL_EXERCISES is the single source of truth for all facial exercise definitions.
 *
 * Fields:
 *   id               — unique string key, used as state value in FacialExercisePage
 *   label            — short display name shown in the UI
 *   description      — one-sentence context shown to the user
 *   instructionText  — direct action-oriented instruction spoken/shown during exercise
 *   region           — broad facial region, used for future landmark group lookup
 *   requiredLandmarks — placeholder: filled in when MediaPipe is integrated (see landmarks.js)
 *   metricFunctionKey — key into the future metrics registry (utils/metrics.js)
 *   thresholds        — references THRESHOLD_CONFIG keys (thresholds.js); not repeated here
 *   enabled           — false = exercise exists but is not surfaced in the UI yet
 */
export const FACIAL_EXERCISES = [
  {
    id: 'smile',
    label: 'Smile',
    description: 'Work the muscles on both sides of your mouth.',
    instructionText: 'Try to smile as wide and evenly as you can.',
    region: 'mouth',
    requiredLandmarks: [], // filled in thresholds.js + landmarks.js integration
    metricFunctionKey: 'measureSmile',
    enabled: true,
  },
  {
    id: 'eyebrowRaise',
    label: 'Eyebrow Raise',
    description: 'Lift both eyebrows as high as you can.',
    instructionText: 'Raise both eyebrows slowly and hold for a moment.',
    region: 'forehead',
    requiredLandmarks: [],
    metricFunctionKey: 'measureEyebrowRaise',
    enabled: true,
  },
  {
    id: 'eyeClosure',
    label: 'Eye Closure',
    description: 'Close both eyes gently and fully.',
    instructionText: 'Close your eyes gently and hold for a moment.',
    region: 'eyes',
    requiredLandmarks: [],
    metricFunctionKey: 'measureEyeClosure',
    enabled: true,
  },
];

/**
 * Returns only enabled exercises in definition order.
 */
export function getEnabledExercises() {
  return FACIAL_EXERCISES.filter((e) => e.enabled);
}

/**
 * Returns the exercise object for a given id, or undefined if not found.
 */
export function getExerciseById(id) {
  return FACIAL_EXERCISES.find((e) => e.id === id);
}
