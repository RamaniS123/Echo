import { useEffect, useRef, useState } from 'react';
import {
  captureHandBaselineSample,
  averageHandBaseline,
  computeOpenHandMetrics,
  isHandLandmarksValid,
  getOpenHandStatusText,
  SMOOTH,
  HOLD_DURATION_MS,
  MOVEMENT_STABILITY_THRESHOLD,
} from '../utils/handRecoveryMetrics';

/** Number of valid frames to collect for the resting baseline (~1 s at 30 fps). */
const CALIBRATION_FRAMES = 30;

/**
 * Rolling window size for movement quality — number of per-frame tip deltas.
 * Tracks ALL 5 fingertips simultaneously.
 */
const STABILITY_WINDOW = 20;

/** Cap React state updates to ~25 fps. */
const DISPLAY_INTERVAL = 1000 / 25;

const ZERO_METRICS = { openClose: 0, fingerSpread: 0, holdTime: 0, movementQuality: 100 };

/**
 * useOpenHandMetrics
 *
 * Drives the calibration phase and real-time metric computation for the
 * "Open Hand" exercise.
 *
 * Lifecycle:
 *   isTracking=false  → idle, all state reset
 *   isTracking=true   → wait for valid hand landmarks
 *                     → collect CALIBRATION_FRAMES baseline samples
 *                     → compute metrics each frame, throttle setState ~25 fps
 *
 * @param {React.RefObject} landmarksRef   — from useHandTracking (.current = 21-pt array | null)
 * @param {boolean}         isTracking
 * @param {boolean}         handDetected
 *
 * @returns {{ metrics, calibrating, statusText }}
 */
export function useOpenHandMetrics(landmarksRef, isTracking, handDetected) {
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

  // Movement quality: ring buffer of avg per-frame fingertip distances
  const prevTipsRef        = useRef(null);   // previous [x,y] for each of 5 tips
  const frameDistancesRef  = useRef([]);     // rolling window of avg displacement per frame

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

    // Start calibration
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

      // ── Landmarks invalid (shouldn't happen with MediaPipe Hands, but guard) ──
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
          setStatusText('Open your hand wider');
        }

        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // ── Tracking ─────────────────────────────────────────────────────────
      const raw = computeOpenHandMetrics(landmarks, baselineRef.current);

      // ── EMA smoothing (done BEFORE hold timer so isOpen uses stable values) ──
      const s      = smoothedRef.current;
      const smooth = (a, b) => SMOOTH * a + (1 - SMOOTH) * b;

      const next = {
        openClose:       Math.round(smooth(raw.openClose,    s.openClose)),
        fingerSpread:    Math.round(smooth(raw.fingerSpread, s.fingerSpread)),
        holdTime:        0, // filled in below
        movementQuality: 0, // filled in below
      };

      // isOpen from smoothed values so jitter can't reset the timer
      const isOpen = next.openClose >= 60 && next.fingerSpread >= 50;

      // ── Hold time ────────────────────────────────────────────────────────
      if (isOpen) {
        if (holdStartRef.current === null) holdStartRef.current = timestamp;
        holdMsRef.current = timestamp - holdStartRef.current;
      } else {
        holdStartRef.current = null;
        holdMsRef.current    = 0;
      }
      const holdMs = holdMsRef.current;

      // ── Movement quality: avg per-frame 2D displacement of all 5 tips ────
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

      // ── Finalise smoothed metrics ─────────────────────────────────────────
      next.holdTime        = Math.round(holdMs / 1000 * 10) / 10;
      next.movementQuality = Math.round(smooth(movementQuality, s.movementQuality));
      smoothedRef.current  = next;

      // ── Throttle React state updates ──────────────────────────────────────
      if (timestamp - lastDisplayRef.current >= DISPLAY_INTERVAL) {
        lastDisplayRef.current = timestamp;
        const text = getOpenHandStatusText({
          noHand:      false,
          calibrating: false,
          isOpen,
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

  // When hand detection flips to false mid-session, show clear message
  useEffect(() => {
    if (!isTracking || !baselineRef.current) return;
    if (!handDetected) setStatusText('No hand detected');
  }, [handDetected, isTracking]);

  return { metrics, calibrating, statusText };
}
