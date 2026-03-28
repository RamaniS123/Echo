import { useEffect, useRef, useState } from 'react';
import {
  captureBaselineSample,
  averageBaseline,
  computeSmileMovement,
  getStatusText,
} from '../utils/smileMetrics';

/**
 * Number of landmark frames to collect before locking in the neutral baseline.
 * At ~60 fps this is roughly 1 second, giving the user time to settle.
 */
const CALIBRATION_FRAMES = 55;

/**
 * Exponential moving-average blend factor for smoothing raw metric values.
 * 0 = no response (frozen), 1 = no smoothing (jittery). 0.25 is a good default.
 */
const SMOOTH = 0.25;

/**
 * Cap state updates to this rate (ms) so React doesn't re-render at 60 fps.
 * 30 fps feels live without taxing the render cycle.
 */
const DISPLAY_INTERVAL = 1000 / 30;

const ZERO_METRICS = { left: 0, right: 0, strength: 0, symmetry: 100 };

/**
 * useSmileMetrics
 *
 * Reads from `landmarksRef` (provided by useFaceTracking) in its own RAF
 * loop — no second MediaPipe call is made.
 *
 * Lifecycle:
 *   isTracking=false → idle, all state reset
 *   isTracking=true  → collect CALIBRATION_FRAMES neutral samples (~1 s)
 *                    → lock baseline, compute + smooth metrics each frame
 *                    → throttle setState to ~30 fps
 *
 * @param {React.RefObject} landmarksRef  — from useFaceTracking; .current is
 *   NormalizedLandmark[] | null updated at the MediaPipe frame rate.
 * @param {boolean}         isTracking    — start/stop the loop
 * @param {boolean}         faceDetected  — from useFaceTracking; used for
 *   status text only, not metric gating.
 *
 * @returns {{
 *   metrics:    { left, right, strength, symmetry },
 *   calibrating: boolean,
 *   statusText:  string,
 * }}
 */
export function useSmileMetrics(landmarksRef, isTracking, faceDetected) {
  const [calibrating, setCalibrating] = useState(false);
  const [metrics,     setMetrics]     = useState(ZERO_METRICS);
  const [statusText,  setStatusText]  = useState('Press start to begin');

  // Mutable loop state — keep as refs to avoid stale closures
  const baselineRef        = useRef(null);
  const baselineSamplesRef = useRef([]);
  const smoothedRef        = useRef({ ...ZERO_METRICS });
  const rafRef             = useRef(null);
  const lastDisplayRef     = useRef(0);

  // ── Main loop: calibration → tracking ────────────────────────────────────
  useEffect(() => {
    if (!isTracking) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      baselineRef.current        = null;
      baselineSamplesRef.current = [];
      smoothedRef.current        = { ...ZERO_METRICS };
      lastDisplayRef.current     = 0;
      setCalibrating(false);
      setMetrics(ZERO_METRICS);
      setStatusText('Press start to begin');
      return;
    }

    // Enter calibration
    baselineRef.current        = null;
    baselineSamplesRef.current = [];
    smoothedRef.current        = { ...ZERO_METRICS };
    setCalibrating(true);
    setStatusText('Hold still to calibrate\u2026');

    function tick(timestamp) {
      const landmarks = landmarksRef.current;

      // ── No face visible ────────────────────────────────────────────────
      if (!landmarks) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // ── Calibration phase ──────────────────────────────────────────────
      if (!baselineRef.current) {
        baselineSamplesRef.current.push(captureBaselineSample(landmarks));

        if (baselineSamplesRef.current.length >= CALIBRATION_FRAMES) {
          baselineRef.current = averageBaseline(baselineSamplesRef.current);
          setCalibrating(false);
          setStatusText('Smile as evenly as you can');
        }

        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // ── Tracking phase ─────────────────────────────────────────────────
      const raw = computeSmileMovement(landmarks, baselineRef.current);

      // EMA smoothing
      const s      = smoothedRef.current;
      const smooth = (a, b) => SMOOTH * a + (1 - SMOOTH) * b;
      const next = {
        left:     Math.round(smooth(raw.left,     s.left)),
        right:    Math.round(smooth(raw.right,    s.right)),
        strength: Math.round(smooth(raw.strength, s.strength)),
        symmetry: Math.round(smooth(raw.symmetry, s.symmetry)),
      };
      smoothedRef.current = next;

      // Throttle React state updates to ~30 fps
      if (timestamp - lastDisplayRef.current >= DISPLAY_INTERVAL) {
        lastDisplayRef.current = timestamp;
        const text = getStatusText({ calibrating: false, faceDetected: true, ...next });
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
  }, [isTracking, landmarksRef]); // faceDetected intentionally excluded — handled below

  // ── Face-lost status update (without restarting the loop) ────────────────
  useEffect(() => {
    if (!isTracking || !baselineRef.current) return;
    if (!faceDetected) setStatusText('No face detected');
  }, [faceDetected, isTracking]);

  return { metrics, calibrating, statusText };
}
