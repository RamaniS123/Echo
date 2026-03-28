/**
 * LANDMARK_GROUPS is the single source of truth for MediaPipe face landmark indices.
 *
 * IMPORTANT: Placeholder arrays ([]) are used until MediaPipe integration is complete.
 * Do NOT scatter raw landmark index numbers across components, utils, or hooks.
 * All landmark lookups must import from this file.
 *
 * Index values will be confirmed against MediaPipe FaceLandmarker output during
 * integration (see: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker).
 *
 * Each entry is an array of landmark indices that define that facial region.
 */
export const LANDMARK_GROUPS = {
  // Mouth corners — used for smile asymmetry
  leftMouthCorner: [],   // e.g. [61]
  rightMouthCorner: [],  // e.g. [291]

  // Upper lip midpoint — used for vertical mouth movement
  upperLipMid: [],       // e.g. [13]

  // Eyebrows — used for eyebrow raise measurement
  leftEyebrow: [],       // e.g. [70, 63, 105, 66, 107]
  rightEyebrow: [],      // e.g. [300, 293, 334, 296, 336]

  // Eyes — used for eye closure measurement
  leftEye: [],           // e.g. [33, 160, 158, 133, 153, 144]
  rightEye: [],          // e.g. [362, 385, 387, 263, 373, 380]

  // Nose tip — stable reference point for normalization
  noseTip: [],           // e.g. [1]

  // Chin — stable reference point for face height normalization
  chin: [],              // e.g. [152]
};

/**
 * Returns the landmark indices for a named region.
 * Throws if the group name is not recognized, to catch typos early.
 */
export function getLandmarkGroup(name) {
  if (!(name in LANDMARK_GROUPS)) {
    throw new Error(`Unknown landmark group: "${name}". Check landmarks.js for valid names.`);
  }
  return LANDMARK_GROUPS[name];
}
