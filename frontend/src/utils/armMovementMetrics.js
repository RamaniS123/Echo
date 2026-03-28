/**
 * armMovementMetrics.js
 *
 * Pure utility functions for the "Raise Right Arm" exercise.
 *
 * MediaPipe Pose landmark numbering used here:
 *   11 — left  shoulder
 *   12 — right shoulder
 *   13 — left  elbow
 *   14 — right elbow
 *   15 — left  wrist
 *   16 — right wrist
 *
 * Coordinate convention (normalised 0–1):
 *   x increases left → right in the original (unmirrored) frame
 *   y increases top  → bottom
 *   Therefore a raised wrist has a SMALLER y than the shoulder.
 *
 * Because the webcam feed is CSS-mirrored, the user sees their right arm on
 * the right side of the screen, but in the raw MediaPipe data the right arm
 * landmarks (12, 14, 16) are on the larger-x side of the frame.  The y-axis
 * behaviour is identical either way, so raise detection uses only y.
 */

// ─── Landmark indices ──────────────────────────────────────────────────────

export const POSE_LM = {
  RIGHT_SHOULDER: 12,
  RIGHT_ELBOW:    14,
  RIGHT_WRIST:    16,
  LEFT_SHOULDER:  11,
  LEFT_ELBOW:     13,
  LEFT_WRIST:     15,
};

// ─── Thresholds (all 0–100 unless noted) ──────────────────────────────────

/**
 * Minimum normalised wrist height to count as "raised".
 * Expressed as a fraction of inter-shoulder width above shoulder level.
 * Increased from 0.05 to reduce false positives from small wrist movements.
 */
export const TARGET_RAISE_THRESHOLD = 0.08;

/**
 * How long (milliseconds) the arm must stay above the target before
 * the hold counter starts contributing to the Hold Time display.
 * Matches the "hold for 3 seconds" instruction.
 */
export const HOLD_DURATION_MS = 3000;

/**
 * EMA smoothing factor for displayed metrics.
 * 0 = frozen, 1 = no smoothing.  0.2 gives a gentle lag.
 */
export const SMOOTH = 0.2;

/**
 * Average per-frame Euclidean wrist movement (normalised coords) that maps
 * to 0% stability.  Values below this proportion of the threshold yield
 * progressively higher stability scores.  Uses 2-D (x and y) movement.
 */
export const STABILITY_JITTER_THRESHOLD = 0.015;

/** Minimum landmark visibility score (0–1) to trust a landmark for metrics. */
export const LANDMARK_VISIBILITY_THRESHOLD = 0.5;

/**
 * Maximum distance (fraction of shoulder width) the elbow may hang BELOW
 * shoulder level while still counting as a valid side-raise.
 * Prevents bicep-curl false positives where the wrist rises but the elbow
 * stays at hip height.
 */
export const ELBOW_DROP_TOLERANCE = 0.20;

// ─── Calibration ──────────────────────────────────────────────────────────

/**
 * Capture one resting baseline sample.
 *
 * @param {NormalizedLandmark[]} landmarks
 * @returns {{ shoulderY: number, wristY: number, shoulderWidth: number }}
 */
export function captureArmBaselineSample(landmarks) {
  const rs = landmarks[POSE_LM.RIGHT_SHOULDER];
  const rw = landmarks[POSE_LM.RIGHT_WRIST];
  const ls = landmarks[POSE_LM.LEFT_SHOULDER];

  // Inter-shoulder distance normalises movement to body size
  const shoulderWidth = Math.abs(rs.x - ls.x) || 0.2;

  return {
    shoulderY:     rs.y,
    wristY:        rw.y,
    shoulderWidth,
  };
}

/**
 * Average an array of baseline samples.
 *
 * @param {Array<{shoulderY, wristY, shoulderWidth}>} samples
 * @returns {{ shoulderY: number, wristY: number, shoulderWidth: number }}
 */
export function averageArmBaseline(samples) {
  const n   = samples.length;
  const avg = (key) => samples.reduce((t, s) => t + s[key], 0) / n;
  return {
    shoulderY:     avg('shoulderY'),
    wristY:        avg('wristY'),
    shoulderWidth: avg('shoulderWidth'),
  };
}

// ─── Landmark validity ────────────────────────────────────────────────────

/**
 * Returns true when all four landmarks needed for arm tracking exist and
 * have adequate visibility confidence (≥ LANDMARK_VISIBILITY_THRESHOLD).
 *
 * @param {NormalizedLandmark[]} landmarks
 * @returns {boolean}
 */
export function areLandmarksValid(landmarks) {
  if (!landmarks || landmarks.length < 17) return false;
  const required = [
    POSE_LM.RIGHT_SHOULDER,
    POSE_LM.RIGHT_ELBOW,
    POSE_LM.RIGHT_WRIST,
    POSE_LM.LEFT_SHOULDER,
  ];
  return required.every((idx) => {
    const lm = landmarks[idx];
    return lm && (lm.visibility ?? 1) >= LANDMARK_VISIBILITY_THRESHOLD;
  });
}

// ─── Metric computation ────────────────────────────────────────────────────

/**
 * Compute raw (unsmoothed) raise metrics for the current frame.
 *
 * Height:
 *   How high the wrist is above the shoulder, normalised by shoulder width,
 *   then mapped to 0–100.  0 = at rest or below shoulder, 100 = fully extended.
 *
 * Range of Motion:
 *   Total distance wrist has moved upward from baseline wrist position,
 *   also normalised by shoulder width, mapped to 0–100.
 *
 * Stability (rolling window):
 *   Computed externally by the hook using a window of recent wrist-y values.
 *   This function returns the raw wristY for the hook to track.
 *
 * @param {NormalizedLandmark[]} landmarks
 * @param {{ shoulderY, wristY, shoulderWidth }} baseline
 * @returns {{
 *   height: number,         // 0–100
 *   rangeOfMotion: number,  // 0–100
 *   rawWristY: number,      // raw y for stability window
 *   isAboveTarget: boolean,
 * }}
 */
export function computeRaiseRightArmMetrics(landmarks, baseline) {
  const rw = landmarks[POSE_LM.RIGHT_WRIST];
  const rs = landmarks[POSE_LM.RIGHT_SHOULDER];
  const re = landmarks[POSE_LM.RIGHT_ELBOW];

  const sw = baseline.shoulderWidth;

  // How far ABOVE the shoulder is the wrist?
  // shoulderY - wristY: positive when wrist is above shoulder (y increases downward)
  const wristAboveShoulder = rs.y - rw.y;

  // How far ABOVE the resting baseline wrist position is the current wrist?
  const wristAboveBaseline = baseline.wristY - rw.y;

  const RAISE_SCALE = 200; // tuned so a full side-raise reaches ~100
  const height = Math.round(Math.max(0, Math.min(100,
    (wristAboveShoulder / sw) * RAISE_SCALE,
  )));

  const ROM_SCALE = 160;
  const rangeOfMotion = Math.round(Math.max(0, Math.min(100,
    (wristAboveBaseline / sw) * ROM_SCALE,
  )));

  // Elbow sanity check: elbow must not hang more than ELBOW_DROP_TOLERANCE * shoulderWidth
  // below shoulder level.  Catches bicep-curl false positives where the wrist
  // rises while the elbow stays at hip height.
  const elbowDropFromShoulder = re.y - rs.y; // positive = elbow is BELOW shoulder
  const isAboveTarget =
    wristAboveShoulder    >= TARGET_RAISE_THRESHOLD * sw &&
    elbowDropFromShoulder <= ELBOW_DROP_TOLERANCE * sw;

  return {
    height,
    rangeOfMotion,
    rawWristY: rw.y,
    rawWristX: rw.x,
    isAboveTarget,
  };
}

// ─── Status text ───────────────────────────────────────────────────────────

/**
 * Returns a short coaching string for the Raise Right Arm exercise.
 *
 * @param {{
 *   calibrating: boolean,
 *   poseDetected: boolean,
 *   height: number,
 *   isAboveTarget: boolean,
 *   holdMs: number,
 * }} state
 * @returns {string}
 */
/**
 * Priority order (highest to lowest):
 *   no pose → low confidence → calibrating → below target → above target → holding → great
 *
 * @param {{
 *   noPose:        boolean,
 *   calibrating:   boolean,
 *   isAboveTarget: boolean,
 *   holdMs:        number,
 * }} state
 */
export function getRaiseRightArmStatusText({
  noPose,
  calibrating,
  isAboveTarget,
  holdMs,
}) {
  if (noPose)         return 'No body detected';
  if (calibrating)    return 'Hold still to calibrate\u2026';
  if (!isAboveTarget) return 'Raise your right arm higher';
  if (holdMs >= HOLD_DURATION_MS) return 'Great job \u2014 well done!';
  if (holdMs >= 1500) return 'Hold that position';
  return 'Good height \u2014 keep going';
}

// ─── Canvas overlay ────────────────────────────────────────────────────────

/**
 * Draw the arm skeleton overlay on a 2-D canvas context.
 *
 * Mirror convention: react-webcam's `mirrored` prop applies CSS scaleX(-1) to
 * the <video> element only.  The canvas is a sibling with no CSS mirror, so we
 * must manually flip the x-axis when mapping normalised landmarks to pixels.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {NormalizedLandmark[]}    landmarks
 * @param {number}                  w  canvas width  (px)
 * @param {number}                  h  canvas height (px)
 */
export function drawArmOverlay(ctx, landmarks, w, h) {
  const rs = landmarks[POSE_LM.RIGHT_SHOULDER];
  const re = landmarks[POSE_LM.RIGHT_ELBOW];
  const rw = landmarks[POSE_LM.RIGHT_WRIST];
  const ls = landmarks[POSE_LM.LEFT_SHOULDER];

  // Mirror x to align with the CSS-mirrored webcam feed
  const px = (lm) => [(1 - lm.x) * w, lm.y * h];

  const [rsX, rsY] = px(rs);
  const [reX, reY] = px(re);
  const [rwX, rwY] = px(rw);
  const [lsX, lsY] = px(ls);

  // Re-derive isAboveTarget locally for colour selection (no baseline required)
  const sw                  = Math.abs(rs.x - ls.x) || 0.2;
  const wristAboveShoulder  = rs.y - rw.y;
  const elbowDropFromShoulder = re.y - rs.y;
  const isAboveTarget =
    wristAboveShoulder    >= TARGET_RAISE_THRESHOLD * sw &&
    elbowDropFromShoulder <= ELBOW_DROP_TOLERANCE   * sw;

  const armColor = isAboveTarget ? '#2ecc71' : '#3ecfb2'; // green when raised, teal otherwise

  // ── Shoulder-to-shoulder reference bar ──────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(lsX, lsY);
  ctx.lineTo(rsX, rsY);
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  ctx.restore();

  // ── Dashed horizontal line at shoulder height ────────────────────────────
  const midShoulderY = (rsY + lsY) / 2;
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, midShoulderY);
  ctx.lineTo(w, midShoulderY);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth   = 1;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── Right arm skeleton ───────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(rsX, rsY);
  ctx.lineTo(reX, reY);
  ctx.lineTo(rwX, rwY);
  ctx.strokeStyle = armColor + 'cc'; // ~80% opacity
  ctx.lineWidth   = 3.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.shadowColor = armColor;
  ctx.shadowBlur  = 10;
  ctx.stroke();
  ctx.restore();

  // ── Joint dots ───────────────────────────────────────────────────────────
  const dot = (x, y, radius, color, glow = true) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    if (glow) { ctx.shadowBlur = 12; ctx.shadowColor = color; }
    ctx.fill();
    ctx.restore();
  };

  dot(lsX, lsY, 5, 'rgba(255,255,255,0.45)', false); // left  shoulder (reference)
  dot(rsX, rsY, 6, armColor, true);                   // right shoulder
  dot(reX, reY, 5, armColor, true);                   // right elbow
  dot(rwX, rwY, 7, armColor, true);                   // right wrist
}

// ─── Left arm ────────────────────────────────────────────────────────────────
// Mirrors the right-arm functions above but uses LEFT_SHOULDER / LEFT_ELBOW /
// LEFT_WRIST landmarks (indices 11, 13, 15).

export function areLandmarksValidLeft(landmarks) {
  if (!landmarks || landmarks.length < 17) return false;
  const required = [
    POSE_LM.LEFT_SHOULDER,
    POSE_LM.LEFT_ELBOW,
    POSE_LM.LEFT_WRIST,
    POSE_LM.RIGHT_SHOULDER,
  ];
  return required.every((idx) => {
    const lm = landmarks[idx];
    return lm && (lm.visibility ?? 1) >= LANDMARK_VISIBILITY_THRESHOLD;
  });
}

export function captureLeftArmBaselineSample(landmarks) {
  const ls = landmarks[POSE_LM.LEFT_SHOULDER];
  const lw = landmarks[POSE_LM.LEFT_WRIST];
  const rs = landmarks[POSE_LM.RIGHT_SHOULDER];

  const shoulderWidth = Math.abs(rs.x - ls.x) || 0.2;

  return {
    shoulderY:     ls.y,
    wristY:        lw.y,
    shoulderWidth,
  };
}

export function computeRaiseLeftArmMetrics(landmarks, baseline) {
  const lw = landmarks[POSE_LM.LEFT_WRIST];
  const ls = landmarks[POSE_LM.LEFT_SHOULDER];
  const le = landmarks[POSE_LM.LEFT_ELBOW];

  const sw = baseline.shoulderWidth;

  const wristAboveShoulder    = ls.y - lw.y;
  const wristAboveBaseline    = baseline.wristY - lw.y;
  const elbowDropFromShoulder = le.y - ls.y;

  const RAISE_SCALE = 200;
  const height = Math.round(Math.max(0, Math.min(100,
    (wristAboveShoulder / sw) * RAISE_SCALE,
  )));

  const ROM_SCALE = 160;
  const rangeOfMotion = Math.round(Math.max(0, Math.min(100,
    (wristAboveBaseline / sw) * ROM_SCALE,
  )));

  const isAboveTarget =
    wristAboveShoulder    >= TARGET_RAISE_THRESHOLD * sw &&
    elbowDropFromShoulder <= ELBOW_DROP_TOLERANCE   * sw;

  return {
    height,
    rangeOfMotion,
    rawWristY: lw.y,
    rawWristX: lw.x,
    isAboveTarget,
  };
}

export function getRaiseLeftArmStatusText({
  noPose,
  calibrating,
  isAboveTarget,
  holdMs,
}) {
  if (noPose)         return 'No body detected';
  if (calibrating)    return 'Hold still to calibrate…';
  if (!isAboveTarget) return 'Raise your left arm higher';
  if (holdMs >= HOLD_DURATION_MS) return 'Great job — well done!';
  if (holdMs >= 1500) return 'Hold that position';
  return 'Good height — keep going';
}

export function drawLeftArmOverlay(ctx, landmarks, w, h) {
  const ls = landmarks[POSE_LM.LEFT_SHOULDER];
  const le = landmarks[POSE_LM.LEFT_ELBOW];
  const lw = landmarks[POSE_LM.LEFT_WRIST];
  const rs = landmarks[POSE_LM.RIGHT_SHOULDER];

  const px = (lm) => [(1 - lm.x) * w, lm.y * h];

  const [lsX, lsY] = px(ls);
  const [leX, leY] = px(le);
  const [lwX, lwY] = px(lw);
  const [rsX, rsY] = px(rs);

  const sw                    = Math.abs(rs.x - ls.x) || 0.2;
  const wristAboveShoulder    = ls.y - lw.y;
  const elbowDropFromShoulder = le.y - ls.y;
  const isAboveTarget =
    wristAboveShoulder    >= TARGET_RAISE_THRESHOLD * sw &&
    elbowDropFromShoulder <= ELBOW_DROP_TOLERANCE   * sw;

  const armColor = isAboveTarget ? '#2ecc71' : '#3ecfb2';

  // ── Shoulder-to-shoulder reference bar
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(lsX, lsY);
  ctx.lineTo(rsX, rsY);
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  ctx.restore();

  // ── Dashed horizontal line at shoulder height
  const midShoulderY = (lsY + rsY) / 2;
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, midShoulderY);
  ctx.lineTo(w, midShoulderY);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth   = 1;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── Left arm skeleton
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(lsX, lsY);
  ctx.lineTo(leX, leY);
  ctx.lineTo(lwX, lwY);
  ctx.strokeStyle = armColor + 'cc';
  ctx.lineWidth   = 3.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.shadowColor = armColor;
  ctx.shadowBlur  = 10;
  ctx.stroke();
  ctx.restore();

  // ── Joint dots
  const dot = (x, y, radius, color, glow = true) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    if (glow) { ctx.shadowBlur = 12; ctx.shadowColor = color; }
    ctx.fill();
    ctx.restore();
  };

  dot(rsX, rsY, 5, 'rgba(255,255,255,0.45)', false); // right shoulder (reference)
  dot(lsX, lsY, 6, armColor, true);                   // left  shoulder
  dot(leX, leY, 5, armColor, true);                   // left  elbow
  dot(lwX, lwY, 7, armColor, true);                   // left  wrist
}
