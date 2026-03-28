/**
 * THRESHOLD_CONFIG contains all numeric scoring thresholds for facial exercises.
 *
 * Keys match exercise ids in exercises.js.
 *
 * Fields per exercise:
 *   low          — movement score below this is considered minimal/no movement
 *   high         — movement score at or above this is considered a strong effort
 *   symmetryWarn — symmetry delta above this value triggers a symmetry warning
 *
 * All values are provisional placeholders to be calibrated during MediaPipe integration.
 * Do NOT copy these values directly into components or hooks — import from here.
 */
export const THRESHOLD_CONFIG = {
  smile: {
    low: 0.1,
    high: 0.4,
    symmetryWarn: 0.15,
  },
  eyebrowRaise: {
    low: 0.05,
    high: 0.25,
    symmetryWarn: 0.12,
  },
  eyeClosure: {
    low: 0.1,
    high: 0.45,
    symmetryWarn: 0.1,
  },
};

/**
 * SYMMETRY_THRESHOLDS define the global symmetry score bands shown in the UI.
 *
 * Scores are 0–100 (100 = perfect symmetry).
 * These are display thresholds only — not clinical assessments.
 */
export const SYMMETRY_THRESHOLDS = {
  good: 80,  // score >= good → green / positive feedback
  warn: 55,  // score >= warn && < good → amber / encourage more effort
  poor: 0,   // score < warn → red / gentle guidance
};

/**
 * SPEECH_THRESHOLDS define minimum signal values to consider a speech attempt valid.
 *
 * These are used by the feedback rule engine (not clinical thresholds).
 */
export const SPEECH_THRESHOLDS = {
  minDurationMs: 300,    // attempts shorter than this are treated as no speech
  minVolume: 0.05,       // RMS value below this is treated as too quiet
  minSimilarity: 0.5,    // transcript similarity below this is treated as weak match
};

/**
 * Returns the threshold config for a given exercise id.
 * Returns undefined if the exercise id has no entry.
 */
export function getThresholdsForExercise(exerciseId) {
  return THRESHOLD_CONFIG[exerciseId];
}
