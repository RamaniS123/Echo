/**
 * smileMetrics.js
 *
 * Pure utility functions for smile exercise measurement.
 * No React, no state — safe to call from any context.
 *
 * Landmark coordinate convention (MediaPipe 478-point model):
 *   - Coordinates are normalised 0→1 (x: left→right, y: top→bottom) in the
 *     RAW UNMIRRORED frame that MediaPipe processes.
 *   - Camera-left (small x) = person's anatomical RIGHT.
 *   - Camera-right (large x) = person's anatomical LEFT.
 *   - The webcam display is CSS-mirrored, so the person's left appears on the
 *     LEFT of the screen — matching their self-perception in a mirror.
 *
 * Tilt compensation:
 *   All movement is measured in the face's own coordinate frame (projected onto
 *   the axis perpendicular to the eye line). This makes measurements immune to
 *   head roll: tilting left/right no longer registers as a fake smile.
 */

// ─── Landmark indices ────────────────────────────────────────────────────────

export const LM = {
  // Mouth corners — defined relative to the MIRRORED display so that
  // "Left" in the UI matches what the person sees as their left side.
  // In the raw frame, person's left = camera-right = larger x value.
  LEFT_MOUTH_CORNER:  291,  // camera-right → person's LEFT  → appears LEFT  in mirror
  RIGHT_MOUTH_CORNER:  61,  // camera-left  → person's RIGHT → appears RIGHT in mirror

  NOSE_TIP: 1,

  // Eye outer corners — same mirror-aware convention.
  LEFT_EYE_OUTER:  263,  // camera-right → person's left  → LEFT  in mirror
  RIGHT_EYE_OUTER:  33,  // camera-left  → person's right → RIGHT in mirror

  // Skull landmarks — do not move when blinking; used for the stable face
  // reference frame so that eye closure cannot perturb smile measurements.
  FOREHEAD: 10,   // upper forehead (mid-sagittal)
  CHIN:     152,  // chin (mentum)
};

// ─── Face scale ──────────────────────────────────────────────────────────────

/**
 * Inter-ocular distance between outer eye corners.
 * Used to normalise movement so results are independent of face size / distance.
 */
export function getFaceScale(landmarks) {
  const lo = landmarks[LM.LEFT_EYE_OUTER];
  const ro = landmarks[LM.RIGHT_EYE_OUTER];
  const dx = lo.x - ro.x;
  const dy = lo.y - ro.y;
  return Math.sqrt(dx * dx + dy * dy) || 0.2;
}

// ─── Tilt-compensated face projection ────────────────────────────────────────

/**
 * Compute the face's "up" unit vector and eye-midpoint center.
 *
 * The face "up" vector is perpendicular to the line between the outer eye
 * corners. Projecting any landmark onto this vector gives its height *in face
 * space*, which is invariant to head roll:
 *
 *   • Pure head tilt  → eye line rotates → faceUp rotates equally
 *                      → corner projections are unchanged
 *   • Real smile      → corners move along faceUp → projection increases
 *
 * @returns {{ cx, cy, faceUpX, faceUpY }}
 */
function getFaceAligned(landmarks) {
  const re       = landmarks[LM.RIGHT_EYE_OUTER];
  const le       = landmarks[LM.LEFT_EYE_OUTER];
  const nose     = landmarks[LM.NOSE_TIP];
  const forehead = landmarks[LM.FOREHEAD];
  const chin     = landmarks[LM.CHIN];

  // Face "up" direction: chin → forehead.
  // These are skull landmarks — they don't move when the eyes close, so
  // blinking cannot perturb the face reference frame or the smile measurement.
  // For a level face: updx≈0, updy≈-0.83  →  faceUpX≈0, faceUpY≈-1  (up in image ✓)
  const updx  = forehead.x - chin.x;
  const updy  = forehead.y - chin.y;
  const upLen = Math.sqrt(updx * updx + updy * updy) || 1;
  const faceUpX = updx / upLen;
  const faceUpY = updy / upLen;

  // Nose tip as projection centre — stable, unaffected by eye movements.
  const cx = nose.x;
  const cy = nose.y;

  // Eye-line angle is kept for the head-roll gate only.
  const dx = le.x - re.x;
  const dy = le.y - re.y;
  const eyeAngle = Math.atan2(dy, dx);

  return { cx, cy, faceUpX, faceUpY, eyeAngle };
}

/**
 * Project a landmark onto the face "up" axis, relative to the face centre.
 * @returns {number} Larger value = higher in face-aligned space.
 */
function projectFaceUp(lm, cx, cy, faceUpX, faceUpY) {
  return (lm.x - cx) * faceUpX + (lm.y - cy) * faceUpY;
}

// ─── Calibration ─────────────────────────────────────────────────────────────

/**
 * Snapshot of the neutral-face baseline in face-aligned coordinates.
 * Collect CALIBRATION_FRAMES of these, then call averageBaseline().
 *
 * @returns {{ leftFaceUp, rightFaceUp, scale }}
 */
export function captureBaselineSample(landmarks) {
  const { cx, cy, faceUpX, faceUpY, eyeAngle } = getFaceAligned(landmarks);
  return {
    leftFaceUp:  projectFaceUp(landmarks[LM.LEFT_MOUTH_CORNER],  cx, cy, faceUpX, faceUpY),
    rightFaceUp: projectFaceUp(landmarks[LM.RIGHT_MOUTH_CORNER], cx, cy, faceUpX, faceUpY),
    scale:       getFaceScale(landmarks),
    eyeAngle,   // stored so tracking frames can detect excessive tilt
  };
}

/**
 * Average an array of baseline samples into one stable baseline object.
 *
 * @param {Array<{leftFaceUp, rightFaceUp, scale, eyeAngle}>} samples
 * @returns {{ leftFaceUp, rightFaceUp, scale, eyeAngle }}
 */
export function averageBaseline(samples) {
  const n = samples.length;
  return {
    leftFaceUp:  samples.reduce((t, s) => t + s.leftFaceUp,  0) / n,
    rightFaceUp: samples.reduce((t, s) => t + s.rightFaceUp, 0) / n,
    scale:       samples.reduce((t, s) => t + s.scale,       0) / n,
    eyeAngle:    samples.reduce((t, s) => t + s.eyeAngle,    0) / n,
  };
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

/**
 * Minimum movement strength (0–100) for a smile to be considered meaningful.
 * Below this, symmetry is undefined and status nudges the user.
 */
export const MIN_SMILE_THRESHOLD = 10;

/**
 * Minimum absolute difference between left and right (0–100) to fire a
 * side-imbalance coaching message.
 */
export const ASYMMETRY_THRESHOLD = 15;

/**
 * Maximum deviation (degrees) of the eye-line angle from the calibrated
 * baseline before metrics are suppressed and the user is told to level up.
 * 10° is noticeable but forgiving enough for slight natural sway.
 */
export const HEAD_ROLL_THRESHOLD = 10;

// ─── Metric computation ───────────────────────────────────────────────────────

/**
 * Scale factor: converts a face-aligned corner rise (in normalised units
 * relative to inter-ocular distance) into a 0–100 display range.
 * A typical full smile lifts corners by ≈0.03–0.05 normalised units;
 * divided by faceScale ≈0.22 gives ≈0.14–0.23; ×450 ≈ 60–100.
 */
const MOVEMENT_SCALE = 450;

/**
 * Compute raw (unsmoothed) smile metrics relative to the calibrated baseline.
 *
 * Uses face-aligned projection so head tilt does NOT register as a smile.
 * symmetry is null when strength < MIN_SMILE_THRESHOLD.
 *
 * @param {NormalizedLandmark[]} landmarks
 * @param {{ leftFaceUp, rightFaceUp, scale }} baseline
 * @returns {{ left, right, strength, symmetry: number|null }}
 */
/**
 * Compute raw (unsmoothed) smile metrics relative to the calibrated baseline.
 *
 * HEAD ROLL GATE: if the eye-line angle has shifted more than HEAD_ROLL_THRESHOLD
 * degrees from baseline, `headTilted` is true and all metric values are zeroed.
 * The caller should skip EMA updates when headTilted to prevent accumulation.
 *
 * symmetry is null when strength < MIN_SMILE_THRESHOLD.
 *
 * @param {NormalizedLandmark[]} landmarks
 * @param {{ leftFaceUp, rightFaceUp, scale, eyeAngle }} baseline
 * @returns {{ left, right, strength, symmetry: number|null, headTilted: boolean }}
 */
export function computeSmileMovement(landmarks, baseline) {
  const { cx, cy, faceUpX, faceUpY, eyeAngle } = getFaceAligned(landmarks);

  // ── Head roll gate ────────────────────────────────────────────────────
  const tiltDeg = Math.abs(eyeAngle - baseline.eyeAngle) * (180 / Math.PI);
  if (tiltDeg > HEAD_ROLL_THRESHOLD) {
    return { left: 0, right: 0, strength: 0, symmetry: null, headTilted: true };
  }

  // ── Normal metric computation ─────────────────────────────────────────
  const curLeftUp  = projectFaceUp(landmarks[LM.LEFT_MOUTH_CORNER],  cx, cy, faceUpX, faceUpY);
  const curRightUp = projectFaceUp(landmarks[LM.RIGHT_MOUTH_CORNER], cx, cy, faceUpX, faceUpY);

  const leftRaw  = (curLeftUp  - baseline.leftFaceUp)  / baseline.scale * MOVEMENT_SCALE;
  const rightRaw = (curRightUp - baseline.rightFaceUp) / baseline.scale * MOVEMENT_SCALE;

  const left     = Math.round(Math.max(0, Math.min(100, leftRaw)));
  const right    = Math.round(Math.max(0, Math.min(100, rightRaw)));
  const strength = Math.round((left + right) / 2);

  const symmetry = strength < MIN_SMILE_THRESHOLD
    ? null
    : Math.round((1 - Math.abs(left - right) / (left + right)) * 100);

  return { left, right, strength, symmetry, headTilted: false };
}
// ─── Coaching text ───────────────────────────────────────────────────────────

/**
 * Returns a short coaching string based on current session state and metrics.
 * Uses named booleans to keep the logic readable and deterministic.
 *
 * @param {{ calibrating, faceDetected, left, right, strength, symmetry }} state
 * @returns {string}
 */
export function getStatusText({ calibrating, faceDetected, headTilted, left, right, strength, symmetry }) {
  if (calibrating)   return 'Hold still to calibrate\u2026';
  if (!faceDetected) return 'No face detected';
  if (headTilted)    return 'Keep your head level';

  const isSmiling     = strength >= MIN_SMILE_THRESHOLD;
  const isLeftWeaker  = isSmiling && (right - left)  > ASYMMETRY_THRESHOLD;
  const isRightWeaker = isSmiling && (left  - right) > ASYMMETRY_THRESHOLD;
  const isSymmetric   = isSmiling && symmetry !== null && symmetry >= 80;

  if (!isSmiling)    return 'Try smiling a little more';
  if (isLeftWeaker)  return 'Your left side is weaker';
  if (isRightWeaker) return 'Your right side is weaker';
  if (isSymmetric)   return 'Good symmetry';
  return 'Smile as evenly as you can';
}

// ─── Canvas overlay ──────────────────────────────────────────────────────────

/**
 * Draw landmark dots and a mouth-corner connector line onto a canvas element.
 *
 * The canvas must be the same physical size as the displayed video.  Since the
 * video is CSS-mirrored (scaleX(-1)), x-coordinates are flipped:
 *   screen_x = (1 - landmark.x) * canvasWidth
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {NormalizedLandmark[]} landmarks
 * @param {number} w  canvas pixel width
 * @param {number} h  canvas pixel height
 */
export function drawLandmarkOverlay(ctx, landmarks, w, h) {
  // Convert normalised landmark to canvas pixel position (with mirror flip)
  const px = (lm) => [(1 - lm.x) * w, lm.y * h];

  const lc = landmarks[LM.LEFT_MOUTH_CORNER];
  const rc = landmarks[LM.RIGHT_MOUTH_CORNER];
  const nt = landmarks[LM.NOSE_TIP];
  const lo = landmarks[LM.LEFT_EYE_OUTER];
  const ro = landmarks[LM.RIGHT_EYE_OUTER];

  const [lcX, lcY] = px(lc);
  const [rcX, rcY] = px(rc);

  // ── Mouth-corner connecting line ──────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(lcX, lcY);
  ctx.lineTo(rcX, rcY);
  ctx.strokeStyle = 'rgba(62, 207, 178, 0.45)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  ctx.restore();

  // ── Landmark dots ─────────────────────────────────────────────────────
  const dot = (x, y, color, radius) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle   = color;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = color;
    ctx.fill();
    ctx.restore();
  };

  dot(lcX,         lcY,         '#3ecfb2',              6);  // left  mouth corner
  dot(rcX,         rcY,         '#3ecfb2',              6);  // right mouth corner
  dot(...px(nt),               'rgba(255,255,255,0.75)', 4); // nose tip
  dot(...px(lo),               'rgba(255,255,255,0.35)', 3); // left  eye outer
  dot(...px(ro),               'rgba(255,255,255,0.35)', 3); // right eye outer
}
