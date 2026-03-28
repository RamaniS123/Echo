/**
 * handRecoveryMetrics.js
 *
 * Pure utility functions for the "Open Hand" exercise.
 *
 * MediaPipe Hands landmark numbering (21 points):
 *   0  — WRIST
 *   1  — THUMB_CMC     2  — THUMB_MCP     3  — THUMB_IP      4  — THUMB_TIP
 *   5  — INDEX_MCP     6  — INDEX_PIP     7  — INDEX_DIP     8  — INDEX_TIP
 *   9  — MIDDLE_MCP   10  — MIDDLE_PIP   11  — MIDDLE_DIP   12  — MIDDLE_TIP
 *  13  — RING_MCP     14  — RING_PIP     15  — RING_DIP     16  — RING_TIP
 *  17  — PINKY_MCP    18  — PINKY_PIP    19  — PINKY_DIP    20  — PINKY_TIP
 *
 * Coordinate convention (normalised 0–1):
 *   x increases left → right in the original (unmirrored) frame
 *   y increases top  → bottom
 *
 * Extension logic:
 *   We measure how far each fingertip is from the wrist, normalised by
 *   palmSize (wrist → middle finger MCP distance).  A relaxed/closed hand
 *   has an extension ratio of ~1.2–1.6; a fully open hand reaches ~2.5–3.5.
 */

// ─── Landmark indices ──────────────────────────────────────────────────────

export const HAND_LM = {
  WRIST:       0,
  THUMB_CMC:   1,  THUMB_MCP:   2,  THUMB_IP:    3,  THUMB_TIP:   4,
  INDEX_MCP:   5,  INDEX_PIP:   6,  INDEX_DIP:   7,  INDEX_TIP:   8,
  MIDDLE_MCP:  9,  MIDDLE_PIP: 10,  MIDDLE_DIP: 11,  MIDDLE_TIP: 12,
  RING_MCP:   13,  RING_PIP:   14,  RING_DIP:   15,  RING_TIP:   16,
  PINKY_MCP:  17,  PINKY_PIP:  18,  PINKY_DIP:  19,  PINKY_TIP:  20,
};

// Connections for overlay drawing
export const HAND_CONNECTIONS = [
  [0,  1], [1,  2], [2,  3], [3,  4],   // thumb
  [0,  5], [5,  6], [6,  7], [7,  8],   // index
  [0,  9], [9, 10], [10,11], [11,12],   // middle
  [0, 13], [13,14], [14,15], [15,16],   // ring
  [0, 17], [17,18], [18,19], [19,20],   // pinky
  [5,  9], [9, 13], [13,17],            // palm arch
];

// ─── Thresholds ───────────────────────────────────────────────────────────

/**
 * How much the average tip-to-wrist / palmSize ratio needs to increase
 * above the calibrated baseline for the metric to read 100%.
 * A real open hand typically extends ~0.5–0.9 above a resting fist.
 */
export const EXTENSION_RANGE = 0.6;

/**
 * How much the average adjacent fingertip spread ratio needs to increase
 * above the calibrated baseline for the metric to read 100%.
 * A real wide-open hand typically spreads ~0.10–0.20 above rest.
 */
export const SPREAD_RANGE = 0.25;

/**
 * How long (ms) the hand must stay open before Hold Time starts counting.
 */
export const HOLD_DURATION_MS = 2000;

/**
 * EMA smoothing factor for displayed metrics.
 * 0 = frozen, 1 = no smoothing.
 */
export const SMOOTH = 0.25;

/**
 * Average per-frame Euclidean fingertip displacement (normalised coords)
 * that maps to 0% movement quality.  Lower = stricter stability requirement.
 */
export const MOVEMENT_STABILITY_THRESHOLD = 0.012;

// ─── Helpers ──────────────────────────────────────────────────────────────

function dist2D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Landmark validity ────────────────────────────────────────────────────

/**
 * Returns true when all 21 hand landmarks are present.
 * MediaPipe Hands doesn't expose per-landmark visibility, so length is enough.
 *
 * @param {NormalizedLandmark[]} landmarks
 * @returns {boolean}
 */
export function isHandLandmarksValid(landmarks) {
  return Array.isArray(landmarks) && landmarks.length >= 21;
}

// ─── Calibration ──────────────────────────────────────────────────────────

/**
 * Capture one resting baseline sample.
 *
 * @param {NormalizedLandmark[]} landmarks
 * @returns {{ avgExtension: number, palmSize: number }}
 */
export function captureHandBaselineSample(landmarks) {
  const wrist     = landmarks[HAND_LM.WRIST];
  const middleMCP = landmarks[HAND_LM.MIDDLE_MCP];
  const palmSize  = dist2D(wrist, middleMCP) || 0.1;

  const tipIdxs = [HAND_LM.THUMB_TIP, HAND_LM.INDEX_TIP, HAND_LM.MIDDLE_TIP, HAND_LM.RING_TIP, HAND_LM.PINKY_TIP];
  const extensions = tipIdxs.map((i) => dist2D(landmarks[i], wrist) / palmSize);
  const avgExtension = extensions.reduce((t, v) => t + v, 0) / extensions.length;

  // Baseline spread: adjacent distances between index–middle–ring–pinky tips
  const fingerTipIdxs = [HAND_LM.INDEX_TIP, HAND_LM.MIDDLE_TIP, HAND_LM.RING_TIP, HAND_LM.PINKY_TIP];
  const fingerTips = fingerTipIdxs.map((i) => landmarks[i]);
  let totalSpread = 0;
  for (let i = 0; i < fingerTips.length - 1; i++) {
    totalSpread += dist2D(fingerTips[i], fingerTips[i + 1]);
  }
  const avgSpread = (totalSpread / (fingerTips.length - 1)) / palmSize;

  return { avgExtension, avgSpread, palmSize };
}

/**
 * Average an array of baseline samples.
 *
 * @param {Array<{avgExtension, palmSize}>} samples
 * @returns {{ avgExtension: number, palmSize: number }}
 */
export function averageHandBaseline(samples) {
  const n = samples.length;
  return {
    avgExtension: samples.reduce((t, s) => t + s.avgExtension, 0) / n,
    avgSpread:    samples.reduce((t, s) => t + s.avgSpread,    0) / n,
    palmSize:     samples.reduce((t, s) => t + s.palmSize,     0) / n,
  };
}

// ─── Metric computation ────────────────────────────────────────────────────

/**
 * Compute raw (unsmoothed) open-hand metrics for the current frame.
 *
 * Open / Close (0–100):
 *   How far the fingertips have extended from the calibrated resting position,
 *   normalised so 100 = fully open at OPEN_EXTENSION_TARGET.
 *
 * Finger Spread (0–100):
 *   Average adjacent fingertip distance, normalised by palmSize,
 *   mapped so 100 = SPREAD_TARGET reached.
 *
 * @param {NormalizedLandmark[]} landmarks
 * @param {{ avgExtension: number, palmSize: number }} baseline
 */
export function computeOpenHandMetrics(landmarks, baseline) {
  const wrist     = landmarks[HAND_LM.WRIST];
  const middleMCP = landmarks[HAND_LM.MIDDLE_MCP];
  const palmSize  = dist2D(wrist, middleMCP) || 0.1;

  const tipIdxs   = [HAND_LM.THUMB_TIP, HAND_LM.INDEX_TIP, HAND_LM.MIDDLE_TIP, HAND_LM.RING_TIP, HAND_LM.PINKY_TIP];
  const tips      = tipIdxs.map((i) => landmarks[i]);
  const extensions = tips.map((tip) => dist2D(tip, wrist) / palmSize);
  const avgExtension = extensions.reduce((t, v) => t + v, 0) / extensions.length;

  // Open / Close: how far above the calibrated resting position
  const baseExt   = baseline.avgExtension;
  const openClose = Math.round(Math.max(0, Math.min(100,
    (avgExtension - baseExt) / EXTENSION_RANGE * 100,
  )));

  // Finger Spread: adjacent distance between index–middle–ring–pinky tips (skip thumb)
  const fingerTips = tips.slice(1); // [index, middle, ring, pinky]
  let totalSpread = 0;
  for (let i = 0; i < fingerTips.length - 1; i++) {
    totalSpread += dist2D(fingerTips[i], fingerTips[i + 1]);
  }
  const avgSpread = (totalSpread / (fingerTips.length - 1)) / palmSize;

  // Spread relative to calibrated resting position — 0% at baseline, 100% at SPREAD_RANGE above baseline
  const baseSpread  = baseline.avgSpread;
  const fingerSpread = Math.round(Math.max(0, Math.min(100,
    (avgSpread - baseSpread) / SPREAD_RANGE * 100,
  )));

  // isOpen used for overlay colour only — hook derives isOpen from smoothed values
  const isOpen = openClose >= 65 && fingerSpread >= 50;

  return {
    openClose,
    fingerSpread,
    rawExtension: avgExtension,
    rawTips:      tips,   // [thumb,index,middle,ring,pinky] tips — for stability ring-buffer
    isOpen,
  };
}

// ─── Status text ──────────────────────────────────────────────────────────

/**
 * @param {{ noHand: boolean, calibrating: boolean, isOpen: boolean, holdMs: number }} state
 * @returns {string}
 */
export function getOpenHandStatusText({ noHand, calibrating, isOpen, holdMs }) {
  if (noHand)                       return 'No hand detected';
  if (calibrating)                  return 'Hold still to calibrate\u2026';
  if (!isOpen)                      return 'Open your hand wider';
  if (holdMs >= HOLD_DURATION_MS)   return 'Great job \u2014 well done!';
  if (holdMs >= 1000)               return 'Hold that position';
  return 'Good opening \u2014 keep going';
}

// ─── Canvas overlay ────────────────────────────────────────────────────────

/**
 * Draw the hand skeleton overlay on a 2-D canvas context.
 *
 * Mirror convention: react-webcam's `mirrored` CSS flip does not affect the
 * sibling <canvas>, so we manually mirror x: canvasX = (1 - lm.x) * w.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {NormalizedLandmark[]}    landmarks
 * @param {number}                  w  canvas width  (px)
 * @param {number}                  h  canvas height (px)
 * @param {boolean}                 isOpen  whether hand meets open threshold
 */
export function drawHandOverlay(ctx, landmarks, w, h, isOpen) {
  const px = (lm) => [(1 - lm.x) * w, lm.y * h];

  const jointColor  = isOpen ? '#2ecc71' : '#3ecfb2'; // green when open, teal otherwise
  const lineColor   = isOpen ? '#2ecc71cc' : '#3ecfb2aa';

  // ── Skeleton connections ─────────────────────────────────────────────────
  ctx.save();
  ctx.lineWidth   = 2;
  ctx.strokeStyle = lineColor;
  ctx.lineCap     = 'round';
  ctx.shadowBlur  = 6;
  ctx.shadowColor = jointColor;

  for (const [a, b] of HAND_CONNECTIONS) {
    const [ax, ay] = px(landmarks[a]);
    const [bx, by] = px(landmarks[b]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  ctx.restore();

  // ── Landmark dots ────────────────────────────────────────────────────────
  const tipSet = new Set([
    HAND_LM.THUMB_TIP, HAND_LM.INDEX_TIP, HAND_LM.MIDDLE_TIP,
    HAND_LM.RING_TIP,  HAND_LM.PINKY_TIP,
  ]);

  for (let i = 0; i < 21; i++) {
    const [x, y] = px(landmarks[i]);
    const isTip  = tipSet.has(i);
    const r      = isTip ? 6 : 3.5;
    const color  = isTip ? jointColor : 'rgba(255,255,255,0.55)';

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle   = color;
    if (isTip) { ctx.shadowBlur = 10; ctx.shadowColor = jointColor; }
    ctx.fill();
    ctx.restore();
  }
}
