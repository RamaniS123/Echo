/**
 * eyebrowMetrics.js
 *
 * Pure utility functions for eyebrow raise exercise measurement.
 * No React — mirrors the structure of smileMetrics.js.
 *
 * ─── Mirror-aware coordinate convention ──────────────────────────────────────
 *   MediaPipe landmarks use the RAW (unmirrored) camera frame:
 *     - camera-left  (smaller x) = person's anatomical RIGHT
 *     - camera-right (larger  x) = person's anatomical LEFT
 *
 *   The webcam display is CSS-mirrored (transform: scaleX(-1)), so:
 *     - what the USER sees as their LEFT  = camera-right = person's LEFT  = larger  x
 *     - what the USER sees as their RIGHT = camera-left  = person's RIGHT = smaller x
 *
 *   All "LEFT" / "RIGHT" labels in this file follow what the USER SEES in the
 *   mirrored preview, which matches their anatomical left/right.
 *
 * ─── Measurement approach ────────────────────────────────────────────────────
 *   Each side is measured as the vertical distance between the eyebrow arch
 *   (averaged across 5 points) and the same-side eye *upper* region (averaged
 *   across 3 eyelid-top points).  Using same-side eye landmarks as the
 *   reference — rather than the nose tip — keeps each side fully independent
 *   and cancels any face-height change during nodding or distance change.
 *
 * ─── Debug / swap flag ───────────────────────────────────────────────────────
 *   Set SWAP_SIDES = true if live testing shows left/right are inverted.
 *   This is the single place to fix a landmark-group mix-up without hunting
 *   through the rest of the code.
 */

// ─── Landmark indices ────────────────────────────────────────────────────────

// ─── Swap flag ────────────────────────────────────────────────────────────────

/**
 * Set to true if live testing shows the "Left" and "Right" values are
 * responding to the wrong eyebrow.  Flips the assignment of internal left/right
 * results to display values without touching any other logic.
 *
 * HOW TO TEST: raise only the eyebrow on the LEFT side of your mirrored
 * webcam preview. If the "Left" card goes up → SWAP_SIDES is correct.
 * If the "Right" card goes up instead → set SWAP_SIDES = true.
 */
export const SWAP_SIDES = true;

// ─── Landmark indices ────────────────────────────────────────────────────────

/**
 * All indices follow the USER-VISIBLE (mirrored) convention:
 *   LEFT  in mirror = person's anatomical left  = camera-right = larger  x ≈ 200–300s
 *   RIGHT in mirror = person's anatomical right = camera-left  = smaller x ≈ 30–100s
 *
 * MediaPipe's own "left"/"right" labels in its documentation ALSO use the
 * subject's perspective, so MediaPipe "left eyebrow" = LEFT in mirror. ✓
 *
 * EYEBROW arches (5 points each, inner → outer):
 *   LEFT_BROW  [70, 63, 105, 66, 107]  — confirmed left  in mirror  (larger  x values)
 *   RIGHT_BROW [300, 293, 334, 296, 336] — confirmed right in mirror  (smaller x values)
 *
 * EYE OUTER CORNERS — used as the per-side vertical reference AND for face
 * scale and head-roll gate.  The outer corners sit directly in line with the
 * brow arch on each side and do NOT move when eyebrows are raised, making
 * them a reliable, per-side stable reference.
 *   LEFT_EYE_OUTER  263  (left  side — larger  x)
 *   RIGHT_EYE_OUTER  33  (right side — smaller x)
 *
 * NOTE: LEFT_EYE_TOP / RIGHT_EYE_TOP were tried as a reference but proved
 * unreliable — the upper eyelid moves *with* the brow on a raise, causing
 * the gap to barely change (self-cancelling).  Outer corners are stable.
 */
const LM = {
  // ── Eyebrow arches ──────────────────────────────────────────────────────
  // LEFT  = user's left in mirror = anatomical left = larger  x ≈ 60–110 range
  // RIGHT = user's right in mirror = anatomical right = smaller x ≈ 290–340 range
  LEFT_BROW:  [70,  63,  105, 66,  107],
  RIGHT_BROW: [300, 293, 334, 296, 336],

  // ── Eye outer corners — per-side reference + scale + head-roll ──────────
  // These do NOT move when eyebrows are raised, making them a stable per-side
  // reference.  Using the same-side outer corner keeps each side independent.
  LEFT_EYE_OUTER:  263,
  RIGHT_EYE_OUTER:  33,
};

// ─── Geometry helpers ────────────────────────────────────────────────────────

/** Inter-ocular distance — normalises all movement to face size. */
function getFaceScale(landmarks) {
  const le = landmarks[LM.LEFT_EYE_OUTER];
  const re = landmarks[LM.RIGHT_EYE_OUTER];
  const dx = le.x - re.x;
  const dy = le.y - re.y;
  return Math.sqrt(dx * dx + dy * dy) || 0.2;
}

/** Eye-line angle — used ONLY for the head-roll gate. */
function getEyeLineAngle(landmarks) {
  const le = landmarks[LM.LEFT_EYE_OUTER];
  const re = landmarks[LM.RIGHT_EYE_OUTER];
  return Math.atan2(le.y - re.y, le.x - re.x);
}

/** Average y across a set of landmark indices. */
function avgY(landmarks, indices) {
  return indices.reduce((sum, i) => sum + landmarks[i].y, 0) / indices.length;
}

/**
 * Compute per-side brow rise relative to the same-side outer eye corner.
 *
 * rise = eyeOuterCorner.y − avgBrowArch.y
 *
 * The outer eye corners are anatomically stable — they do not move when
 * eyebrows are raised (unlike the upper eyelid, which tracks the brow).
 * Using them as the per-side reference gives a clean, large delta on a raise.
 *
 * Returns raw rise values (not normalised) for debugging.
 */
function computeRawRises(landmarks) {
  const leftBrowY   = avgY(landmarks, LM.LEFT_BROW);
  const rightBrowY  = avgY(landmarks, LM.RIGHT_BROW);
  const leftEyeY    = landmarks[LM.LEFT_EYE_OUTER].y;
  const rightEyeY   = landmarks[LM.RIGHT_EYE_OUTER].y;

  return {
    leftRise:  leftEyeY  - leftBrowY,   // larger = brow higher relative to eye corner
    rightRise: rightEyeY - rightBrowY,
    leftBrowY,
    rightBrowY,
    leftEyeY,
    rightEyeY,
  };
}

// ─── Calibration ─────────────────────────────────────────────────────────────

/**
 * Capture one neutral-baseline sample.
 *
 * Stores per-side rise (eye.y − brow.y) plus face scale and eye-line angle.
 * Also records the raw brow y-values so the stability check can detect motion
 * during calibration.
 *
 * @param {NormalizedLandmark[]} landmarks
 * @returns {{ leftRise, rightRise, leftBrowY, rightBrowY, scale, eyeAngle }}
 */
export function captureEyebrowBaselineSample(landmarks) {
  const rises = computeRawRises(landmarks);
  return {
    leftRise:  rises.leftRise,
    rightRise: rises.rightRise,
    leftBrowY: rises.leftBrowY,
    rightBrowY: rises.rightBrowY,
    scale:     getFaceScale(landmarks),
    eyeAngle:  getEyeLineAngle(landmarks),
  };
}

/**
 * Average calibration samples into a stable baseline.
 *
 * Also computes a stability score: the standard deviation of left and right
 * brow y-positions across all samples, normalised by face scale.  A value
 * above CALIBRATION_STABILITY_LIMIT means the face moved too much and the
 * baseline may be unreliable (the hook can choose to warn about this).
 *
 * @param {Array<{leftRise, rightRise, leftBrowY, rightBrowY, scale, eyeAngle}>} samples
 * @returns {{ leftRise, rightRise, scale, eyeAngle, stableCalibration: boolean }}
 */
export function averageEyebrowBaseline(samples) {
  const n = samples.length;
  const avg = (key) => samples.reduce((t, s) => t + s[key], 0) / n;

  const leftRise  = avg('leftRise');
  const rightRise = avg('rightRise');
  const scale     = avg('scale');
  const eyeAngle  = avg('eyeAngle');

  // Stability: std-dev of brow y across samples, relative to face scale.
  // A large deviation means the user was moving during calibration.
  const leftBrowMean  = avg('leftBrowY');
  const rightBrowMean = avg('rightBrowY');
  const leftVar  = samples.reduce((t, s) => t + (s.leftBrowY  - leftBrowMean)  ** 2, 0) / n;
  const rightVar = samples.reduce((t, s) => t + (s.rightBrowY - rightBrowMean) ** 2, 0) / n;
  const motionRatio = (Math.sqrt(leftVar) + Math.sqrt(rightVar)) / 2 / scale;
  // Threshold: more than 3% of inter-ocular distance = too much movement
  const stableCalibration = motionRatio < 0.03;

  return { leftRise, rightRise, scale, eyeAngle, stableCalibration };
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

/**
 * Minimum movement on the STRONGER side (0–100) before any feedback is shown.
 * Eye-region measurement is more sensitive than smile — 12 is a small but
 * meaningful raise; tweak up if you get false positives at rest.
 */
export const MIN_BROW_MOVEMENT_THRESHOLD = 8;

/**
 * Minimum absolute left–right difference that triggers a side-weakness message.
 * 20 means one side must be at least 20 units stronger than the other.
 * Keeps noise from triggering false weakness messages.
 */
export const BROW_ASYMMETRY_THRESHOLD = 20;

/** Maximum eye-line angle deviation (degrees) before metrics are suppressed. */
export const BROW_HEAD_ROLL_THRESHOLD = 10;

/**
 * Converts normalised brow rise delta (brow-eye gap change / inter-ocular scale)
 * to a 0–100 display value.
 *
 * Typical natural raise adds 0.005–0.015 normalised units to the gap;
 * divided by scale ≈ 0.22 → 0.023–0.068; × 600 → 14–41.
 * A strong raise can reach 0.025+ normalised → 0.114+ / scale → ~68+.
 * Strong raises should still reach ~80–90.
 */
const MOVEMENT_SCALE = 600;

// ─── Metric computation ───────────────────────────────────────────────────────

/**
 * Compute raw (unsmoothed) eyebrow raise metrics.
 *
 * Returns both the final 0–100 display values AND a `debug` object containing
 * all intermediate values for the on-screen debug panel.
 *
 * LEFT/RIGHT in the return value already respect SWAP_SIDES so callers
 * do not need to know about the swap.
 *
 * @param {NormalizedLandmark[]} landmarks
 * @param {{ leftRise, rightRise, scale, eyeAngle }} baseline
 * @returns {{
 *   left, right, strength, symmetry: number|null, headTilted: boolean,
 *   debug: {
 *     rawLeftRise, rawRightRise,
 *     baselineLeftRise, baselineRightRise,
 *     deltaLeft, deltaRight,
 *     normalizedLeft, normalizedRight,
 *     swapped: boolean
 *   }
 * }}
 */
export function computeEyebrowMovement(landmarks, baseline) {
  const eyeAngle = getEyeLineAngle(landmarks);

  // ── Head roll gate ────────────────────────────────────────────────────
  const tiltDeg = Math.abs(eyeAngle - baseline.eyeAngle) * (180 / Math.PI);
  if (tiltDeg > BROW_HEAD_ROLL_THRESHOLD) {
    return {
      left: 0, right: 0, strength: 0, symmetry: null, headTilted: true,
      debug: {
        rawLeftRise: 0, rawRightRise: 0,
        baselineLeftRise: baseline.leftRise, baselineRightRise: baseline.rightRise,
        deltaLeft: 0, deltaRight: 0,
        normalizedLeft: 0, normalizedRight: 0,
        swapped: SWAP_SIDES,
      },
    };
  }

  // ── Per-side brow-to-eye measurement ─────────────────────────────────
  const rises = computeRawRises(landmarks);
  const scale = getFaceScale(landmarks);

  // Delta: how much has the brow risen since baseline?
  // Positive = brow moved up (gap between brow and eye increased).
  const deltaLeft  = rises.leftRise  - baseline.leftRise;
  const deltaRight = rises.rightRise - baseline.rightRise;

  // Normalise to face scale and convert to 0–100 display range.
  const normalizedLeft  = deltaLeft  / scale * MOVEMENT_SCALE;
  const normalizedRight = deltaRight / scale * MOVEMENT_SCALE;

  // Internal anatomical left/right (before any swap)
  let internalLeft  = Math.round(Math.max(0, Math.min(100, normalizedLeft)));
  let internalRight = Math.round(Math.max(0, Math.min(100, normalizedRight)));

  // Apply swap if testing reveals the landmark groups are visually inverted.
  const displayLeft  = SWAP_SIDES ? internalRight : internalLeft;
  const displayRight = SWAP_SIDES ? internalLeft  : internalRight;

  const strength = Math.round((displayLeft + displayRight) / 2);

  // Gate symmetry on the STRONGER side so a unilateral raise is detected
  // even when the other side stays near zero.
  const symmetry = Math.max(displayLeft, displayRight) < MIN_BROW_MOVEMENT_THRESHOLD
    ? null
    : Math.round((1 - Math.abs(displayLeft - displayRight) / (displayLeft + displayRight)) * 100);

  return {
    left: displayLeft,
    right: displayRight,
    strength,
    symmetry,
    headTilted: false,
    debug: {
      rawLeftRise:       +rises.leftRise.toFixed(4),
      rawRightRise:      +rises.rightRise.toFixed(4),
      baselineLeftRise:  +baseline.leftRise.toFixed(4),
      baselineRightRise: +baseline.rightRise.toFixed(4),
      deltaLeft:         +deltaLeft.toFixed(4),
      deltaRight:        +deltaRight.toFixed(4),
      normalizedLeft:    +normalizedLeft.toFixed(1),
      normalizedRight:   +normalizedRight.toFixed(1),
      swapped:           SWAP_SIDES,
    },
  };
}

// ─── Coaching text ────────────────────────────────────────────────────────────

/**
 * Returns a short coaching string.  Receives display-space left/right values
 * (already swapped if SWAP_SIDES is true).
 *
 * @param {{ calibrating, faceDetected, headTilted, left, right, strength, symmetry }} state
 * @returns {string}
 */
export function getEyebrowStatusText({ calibrating, faceDetected, headTilted, left, right, strength, symmetry }) {
  if (calibrating)   return 'Hold still to calibrate\u2026';
  if (!faceDetected) return 'No face detected';
  if (headTilted)    return 'Keep your head level';

  const stronger = Math.max(left, right);
  const isMoving      = stronger >= MIN_BROW_MOVEMENT_THRESHOLD;
  // "left is weaker" means the RIGHT side moved more
  const isLeftWeaker  = isMoving && (right - left)  > BROW_ASYMMETRY_THRESHOLD;
  const isRightWeaker = isMoving && (left  - right) > BROW_ASYMMETRY_THRESHOLD;
  const isSymmetric   = isMoving && symmetry !== null && symmetry >= 80;

  if (!isMoving)     return 'Try raising your eyebrows a little more';
  if (isLeftWeaker)  return 'Your left side is weaker';
  if (isRightWeaker) return 'Your right side is weaker';
  if (isSymmetric)   return 'Good symmetry';
  return 'Raise both eyebrows evenly';
}

// ─── Canvas overlay ───────────────────────────────────────────────────────────

/**
 * Draw eyebrow landmark dots and arch polylines onto a canvas element.
 *
 * The canvas is CSS-mirrored (scaleX(-1)), so x-coordinates are flipped:
 *   screen_x = (1 - landmark.x) * canvasWidth
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {NormalizedLandmark[]} landmarks
 * @param {number} w  canvas pixel width
 * @param {number} h  canvas pixel height
 */
export function drawEyebrowOverlay(ctx, landmarks, w, h) {
  const px = (lm) => [(1 - lm.x) * w, lm.y * h];

  const drawBrowArch = (indices) => {
    const pts = indices.map((i) => px(landmarks[i]));

    // connecting polyline along the arch
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.strokeStyle = 'rgba(62, 207, 178, 0.45)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();

    // dot on each brow landmark
    pts.forEach(([x, y]) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(62, 207, 178, 0.9)';
      ctx.fill();
      ctx.restore();
    });
  };

  drawBrowArch(LM.LEFT_BROW);
  drawBrowArch(LM.RIGHT_BROW);
}
