/**
 * smileMetrics.js
 *
 * Pure utility functions for smile exercise measurement.
 * No React, no state — safe to call from any context.
 *
 * Landmark conventions (MediaPipe 478-point model):
 *   - Coordinates are normalised 0→1 (x: left→right, y: top→bottom) in the
 *     raw unmirrored video frame.
 *   - "Left" / "Right" are the person's anatomical sides, not the camera's.
 *   - When smiling, mouth corners move UP (y decreases).
 */

// ─── Landmark indices ────────────────────────────────────────────────────────

export const LM = {
  LEFT_MOUTH_CORNER:  61,  // person's anatomical left
  RIGHT_MOUTH_CORNER: 291, // person's anatomical right
  NOSE_TIP:           1,
  LEFT_EYE_OUTER:     33,  // person's left outer eye corner  — inter-ocular scale
  RIGHT_EYE_OUTER:    263, // person's right outer eye corner — inter-ocular scale
};

// ─── Face scale ──────────────────────────────────────────────────────────────

/**
 * Inter-ocular distance between outer eye corners.
 * Used to normalise vertical movement so results are resolution-independent.
 * Falls back to 0.2 (typical value for a face filling the frame) if near zero.
 */
export function getFaceScale(landmarks) {
  const lo = landmarks[LM.LEFT_EYE_OUTER];
  const ro = landmarks[LM.RIGHT_EYE_OUTER];
  const dx = lo.x - ro.x;
  const dy = lo.y - ro.y;
  return Math.sqrt(dx * dx + dy * dy) || 0.2;
}

// ─── Calibration ─────────────────────────────────────────────────────────────

/**
 * Snapshot of a baseline state captured from a single landmark frame.
 * Collect CALIBRATION_FRAMES of these, then call averageBaseline().
 *
 * @returns {{ leftY: number, rightY: number, scale: number }}
 */
export function captureBaselineSample(landmarks) {
  return {
    leftY:  landmarks[LM.LEFT_MOUTH_CORNER].y,
    rightY: landmarks[LM.RIGHT_MOUTH_CORNER].y,
    scale:  getFaceScale(landmarks),
  };
}

/**
 * Average an array of baseline samples into one stable baseline object.
 *
 * @param {Array<{leftY: number, rightY: number, scale: number}>} samples
 * @returns {{ leftY: number, rightY: number, scale: number }}
 */
export function averageBaseline(samples) {
  const n = samples.length;
  return {
    leftY:  samples.reduce((t, s) => t + s.leftY,  0) / n,
    rightY: samples.reduce((t, s) => t + s.rightY, 0) / n,
    scale:  samples.reduce((t, s) => t + s.scale,  0) / n,
  };
}

// ─── Metric computation ──────────────────────────────────────────────────────

/**
 * Scale factor: converts the normalised corner-rise-to-face-size ratio into a
 * display-friendly 0–100 range.  A typical full smile raises corners by
 * ~0.03–0.05 normalised units; with an inter-ocular faceScale of ~0.22 that
 * gives a ratio of ≈0.14–0.23, which × 450 ≈ 60–100.
 */
const MOVEMENT_SCALE = 450;

/**
 * Compute raw (unsmoothed) smile metrics relative to the calibrated baseline.
 *
 * @param {NormalizedLandmark[]} landmarks
 * @param {{ leftY, rightY, scale }} baseline
 * @returns {{ left: number, right: number, strength: number, symmetry: number }}
 *   All values are integers in [0, 100].
 */
export function computeSmileMovement(landmarks, baseline) {
  const leftY  = landmarks[LM.LEFT_MOUTH_CORNER].y;
  const rightY = landmarks[LM.RIGHT_MOUTH_CORNER].y;

  // Positive when corners have moved upward (i.e., smiling) vs. neutral
  const leftRaw  = (baseline.leftY  - leftY)  / baseline.scale * MOVEMENT_SCALE;
  const rightRaw = (baseline.rightY - rightY) / baseline.scale * MOVEMENT_SCALE;

  const left  = Math.round(Math.max(0, Math.min(100, leftRaw)));
  const right = Math.round(Math.max(0, Math.min(100, rightRaw)));

  const strength = Math.round((left + right) / 2);

  // Symmetry: 100 = both sides equal, 0 = completely one-sided
  const total = left + right;
  const symmetry = total < 2
    ? 100 // both near zero → not moving, treat as symmetric
    : Math.round((1 - Math.abs(left - right) / total) * 100);

  return { left, right, strength, symmetry };
}

// ─── Coaching text ───────────────────────────────────────────────────────────

/**
 * Returns a short coaching string based on current session state and metrics.
 *
 * @param {{ calibrating, faceDetected, left, right, strength, symmetry }} state
 * @returns {string}
 */
export function getStatusText({ calibrating, faceDetected, left, right, strength, symmetry }) {
  if (calibrating)           return 'Hold still to calibrate\u2026';
  if (!faceDetected)         return 'No face detected';
  if (strength < 10)         return 'Try smiling a little more';
  if (symmetry >= 80)        return 'Good symmetry! Keep smiling';
  if (left < right - 15)    return 'Your left side is weaker';
  if (right < left - 15)    return 'Your right side is weaker';
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
