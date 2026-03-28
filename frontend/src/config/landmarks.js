/**
 * LANDMARK_GROUPS is the single source of truth for MediaPipe face landmark indices.
 *
 * Coordinate convention (MediaPipe 478-point model, RAW unmirrored frame):
 *   - Camera-left (smaller x) = person's anatomical RIGHT side.
 *   - Camera-right (larger x) = person's anatomical LEFT side.
 *   - The webcam display is CSS-mirrored, so from the user's self-view:
 *       "Left" landmarks appear on the LEFT  of the screen.
 *       "Right" landmarks appear on the RIGHT of the screen.
 *
 * All indices are defined relative to the mirrored display — what the user
 * sees as "their left" is stored under leftMouthCorner, etc.
 *
 * Reference: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker
 */
export const LANDMARK_GROUPS = {
  // Mouth corners — primary landmarks for smile measurement.
  // 291 = camera-right = person's left  = LEFT  of mirrored display.
  //  61 = camera-left  = person's right = RIGHT of mirrored display.
  leftMouthCorner:  [291],
  rightMouthCorner: [61],

  // Upper lip midpoint — vertical mouth opening reference
  upperLipMid: [13],

  // Eyebrows
  leftEyebrow:  [70, 63, 105, 66, 107],
  rightEyebrow: [300, 293, 334, 296, 336],

  // Eyes (used for eye closure / EAR measurement)
  leftEye:  [33, 160, 158, 133, 153, 144],
  rightEye: [362, 385, 387, 263, 373, 380],

  // Eye outer corners — used for inter-ocular scale and tilt compensation.
  // 263 = camera-right = person's left  = LEFT  of mirrored display.
  //  33 = camera-left  = person's right = RIGHT of mirrored display.
  leftEyeOuter:  [263],
  rightEyeOuter: [33],

  // Stable reference points
  noseTip: [1],
  chin:    [152],
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
