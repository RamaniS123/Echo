import { useEffect, useRef, useState } from 'react';
import {
  captureHandBaselineSample,
  averageHandBaseline,
  computeOpenHandMetrics,
  isHandLandmarksValid,
  getHoldPalmOpenStatusText,
  SMOOTH,
  HOLD_PALM_DURATION_MS,
  HOLD_PALM_STABILITY_THRESHOLD,
  MOVEMENT_STABILITY_THRESHOLD,
} from '../utils/handRecoveryMetrics';

/** Frames needed for resting baseline calibration (~1 s at 30 fps). */
const CALIBRATION_FRAMES = 30;

/** Rolling window for per-frame fingertip displacement. */
const STABILITY_WINDOW = 20;

/** Cap React state updates to ~25 fps. */
const DISPLAY_INTERVAL = 1000 / 25;

/**
 * Smoothed openClose must be at or above this value for the hand to count as
 * "open enough" for the hold-palm exercise.
 */
const OPEN_THRESHOLD = 60;

/**
 * Smoothed fingerSpread must be at or above this value for the hand to count
 * as "spread enough".
 */
const SPREAD_THRESHOLD = 40;

const ZERO_METRICS = { openClose: 0, fingerSpread: 0, holdTime: 0, movementQuality: 100 };

/**
 * useHoldPalmOpenMetrics
 *
 * Drives calibration and real-time metric computation for the
 * "Hold Palm Open" exercise.
 *
 * Differences from useOpenHandMetrics:
 *   - isHolding requires openClose AND fingerSpread AND steadiness all met
 *   - Hold duration target is HOLD_PALM_DURATION_MS (8 s)
 *   - Status text uses getHoldPalmOpenStatusText
 *
 * @param {React.RefObject} landmarksRef  — from useHandTracking
 * @param {boolean}         isTracking
 * @param {boolean}         handDetected
 *
 * @returns {{ metrics, calibrating, statusText }}
 */
export function useHoldPalmOpenMetrics(landmarksRef, isTracking, handDetected) {
  const [calibrating, setCalibrating] = useState(false);
  const [metrics,     setMetrics]     = useState(ZERO_METRICS);
  const [statusText,  setStatusText]  = useState('Press start to begin');

  const baselineRef        = useRef(null);
  const baselineSamplesRef = useRef([]);
  const smoothedRef        = useRef({ ...ZERO_METRICS });
  const rafRef             = useRef(null);
  const lastDisplayRef     = useRef(0);

  // Hold time
  const holdStartRef = useRef(null);
  const holdMsRef    = useRef(0);

  // Steadiness: rolling ring buffer of avg per-frame fingertip displacements
  const prevTipsRef       = useRef(null);
  const frameDistancesRef = useRef([]);

  useEffect(() => {
    if (!isTracking) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      baselineRef.current        = null;
      baselineSamplesRef.current = [];
      smoothedRef.current        = { ...ZERO_METRICS };
      holdStartRef.current       = null;
      holdMsRef.current          = 0;
      prevTipsRef.current        = null;
      frameDistancesRef.current  = [];
      lastDisplayRef.current     = 0;
      setCalibrating(false);
      setMetrics(ZERO_METRICS);
      setStatusText('Press start to begin');
      return;
    }

    // Reset for fresh session
    baselineRef.current        = null;
    baselineSamplesRef.current = [];
    smoothedRef.current        = { ...ZERO_METRICS };
    holdStartRef.current       = null;
    holdMsRef.current          = 0;
    prevTipsRef.current        = null;
    frameDistancesRef.current  = [];
    setCalibrating(true);
    setStatusText('Hold still to calibrate\u2026');

    function tick(timestamp) {
      const landmarks = landmarksRef.current;

      // ── No hand visible ──────────────────────────────────────────────────
      if (!landmarks) {
        if (timestamp - lastDisplayRef.current >= DISPLAY_INTERVAL) {
          lastDisplayRef.current = timestamp;
          setStatusText('No hand detected');
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // ── Landmarks invalid ────────────────────────────────────────────────
      if (!isHandLandmarksValid(landmarks)) {
        if (timestamp - lastDisplayRef.current >= DISPLAY_INTERVAL) {
          lastDisplayRef.current = timestamp;
          setStatusText('Hold your hand clearly in frame');
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // ── Calibration ──────────────────────────────────────────────────────
      if (!baselineRef.current) {
        baselineSamplesRef.current.push(captureHandBaselineSample(landmarks));

        if (baselineSamplesRef.current.length >= CALIBRATION_FRAMES) {
          baselineRef.current = averageHandBaseline(baselineSamplesRef.current);
          setCalibrating(false);
          setStatusText('Open your hand fully');
        }

        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // ── Tracking ─────────────────────────────────────────────────────────
      const raw = computeOpenHandMetrics(landmarks, baselineRef.current);

      // ── EMA smoothing first — hold and status use stable values ──────────
      const s      = smoothedRef.current;
      const smooth = (a, b) => SMOOTH * a + (1 - SMOOTH) * b;

      const next = {
        openClose:       Math.round(smooth(raw.openClose,    s.openClose)),
        fingerSpread:    Math.round(smooth(raw.fingerSpread, s.fingerSpread)),
        holdTime:        0,   // filled below
        movementQuality: 0,   // filled below
      };

      // ── Steadiness: avg per-frame displacement of all 5 fingertips ───────
      const curTipPositions = raw.rawTips.map((lm) => [lm.x, lm.y]);
      let frameAvgDist = 0;
      if (prevTipsRef.current) {
        let total = 0;
        for (let i = 0; i < 5; i++) {
          const dx = curTipPositions[i][0] - prevTipsRef.current[i][0];
          const dy = curTipPositions[i][1] - prevTipsRef.current[i][1];
          total += Math.sqrt(dx * dx + dy * dy);
        }
        frameAvgDist = total / 5;
      }
      prevTipsRef.current = curTipPositions;

      const dists = frameDistancesRef.current;
      dists.push(frameAvgDist);
      if (dists.length > STABILITY_WINDOW) dists.shift();

      let movementQuality = 100;
      if (dists.length >= 3) {
        const avgDist = dists.reduce((t, d) => t + d, 0) / dists.length;
        movementQuality = Math.round(Math.max(0, Math.min(100,
          100 * (1 - avgDist / MOVEMENT_STABILITY_THRESHOLD),
        )));
      }

      next.movementQuality = Math.round(smooth(movementQuality, s.movementQuality));

      // ── Holding conditions: open + spread must be met; steadiness is display-only ──
      const isOpenEnough   = next.openClose    >= OPEN_THRESHOLD;
      const isSpreadEnough = next.fingerSpread >= SPREAD_THRESHOLD;
      const isStableEnough = next.movementQuality >= HOLD_PALM_STABILITY_THRESHOLD;
      const isHolding      = isOpenEnough && isSpreadEnough;

      // ── Hold time ─────────────────────────────────────────────────────────
      if (isHolding) {
        if (holdStartRef.current === null) holdStartRef.current = timestamp;
        holdMsRef.current = timestamp - holdStartRef.current;
      } else {
        holdStartRef.current = null;
        holdMsRef.current    = 0;
      }
      const holdMs = holdMsRef.current;

      next.holdTime       = Math.round(holdMs / 1000 * 10) / 10;
      smoothedRef.current = next;

      // ── Throttle React state updates ──────────────────────────────────────
      if (timestamp - lastDisplayRef.current >= DISPLAY_INTERVAL) {
        lastDisplayRef.current = timestamp;
        const text = getHoldPalmOpenStatusText({
          noHand:        false,
          calibrating:   false,
          isOpenEnough,
          isSpreadEnough,
          isHolding,
          holdMs,
        });
        setMetrics({ ...next });
        setStatusText(text);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isTracking, landmarksRef]);

  return { metrics, calibrating, statusText };
}
