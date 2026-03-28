/**
 * LANDMARK_GROUPS is the single source of truth for MediaPipe face landmark indices.
 *
 * Indices follow the MediaPipe FaceLandmarker (478-point) topology.
 * "Left" and "Right" are from the person's own perspective, not the camera's.
 * The webcam feed is displayed mirrored, but MediaPipe processes the raw
 * (unmirrored) frame — so index 61 is always the person's anatomical left.
 *
 * Reference: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker
 */
export const LANDMARK_GROUPS = {
  // Mouth corners — primary landmarks for smile measurement
  leftMouthCorner:  [61],   // person's anatomical left corner
  rightMouthCorner: [291],  // person's anatomical right corner

  // Upper lip midpoint — vertical mouth opening reference
  upperLipMid: [13],

  // Eyebrows — used for eyebrow raise measurement
  leftEyebrow:  [70, 63, 105, 66, 107],
  rightEyebrow: [300, 293, 334, 296, 336],

  // Eyes — used for eye closure (EAR) measurement
  leftEye:  [33, 160, 158, 133, 153, 144],
  rightEye: [362, 385, 387, 263, 373, 380],

  // Stable reference points for normalization
  noseTip:       [1],
  leftEyeOuter:  [33],   // outer corner, person's left — for inter-ocular scale
  rightEyeOuter: [263],  // outer corner, person's right — for inter-ocular scale
  chin:          [152],
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
