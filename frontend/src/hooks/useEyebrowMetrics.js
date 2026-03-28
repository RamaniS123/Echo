import { useEffect, useRef, useState } from 'react';
import {
  captureEyebrowBaselineSample,
  averageEyebrowBaseline,
  computeEyebrowMovement,
  getEyebrowStatusText,
} from '../utils/eyebrowMetrics';

/**
 * Number of landmark frames to collect before locking in the neutral baseline.
 * At ~60 fps this is roughly 1 second, giving the user time to settle.
 */
const CALIBRATION_FRAMES = 55;

/**
 * Exponential moving-average blend factor.
 * 0 = frozen, 1 = no smoothing.  0.25 matches useSmileMetrics.
 */
const SMOOTH = 0.25;

/**
 * Cap React state updates to ~30 fps — live but not taxing the render cycle.
 */
const DISPLAY_INTERVAL = 1000 / 30;

const ZERO_METRICS = { left: 0, right: 0, strength: 0, symmetry: null };

/**
 * useEyebrowMetrics
 *
 * Mirrors useSmileMetrics in structure and lifecycle; measures eyebrow raise
 * instead of smile.  Reads from the same `landmarksRef` produced by
 * useFaceTracking — no extra MediaPipe call.
 *
 * Lifecycle:
 *   isTracking=false → idle, all state reset
 *   isTracking=true  → collect CALIBRATION_FRAMES neutral samples (~1 s)
 *                    → lock baseline, compute + smooth metrics each frame
 *                    → throttle setState to ~30 fps
 *
 * @param {React.RefObject} landmarksRef  — from useFaceTracking
 * @param {boolean}         isTracking
 * @param {boolean}         faceDetected
 *
 * @returns {{ metrics, calibrating, statusText }}
 */
export function useEyebrowMetrics(landmarksRef, isTracking, faceDetected) {
  const [calibrating,  setCalibrating]  = useState(false);
  const [metrics,      setMetrics]      = useState(ZERO_METRICS);
  const [statusText,   setStatusText]   = useState('Press start to begin');
  const [debugMetrics, setDebugMetrics] = useState(null);

  const baselineRef        = useRef(null);
  const baselineSamplesRef = useRef([]);
  const smoothedRef        = useRef({ ...ZERO_METRICS });
  const rafRef             = useRef(null);
  const lastDisplayRef     = useRef(0);

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
        baselineSamplesRef.current.push(captureEyebrowBaselineSample(landmarks));

        if (baselineSamplesRef.current.length >= CALIBRATION_FRAMES) {
          baselineRef.current = averageEyebrowBaseline(baselineSamplesRef.current);
          setCalibrating(false);
          setStatusText('Raise both eyebrows evenly');
        }

        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // ── Tracking phase ─────────────────────────────────────────────────
      const raw = computeEyebrowMovement(landmarks, baselineRef.current);

      // Head tilted — skip EMA updates to prevent false values bleeding in.
      if (raw.headTilted) {
        if (timestamp - lastDisplayRef.current >= DISPLAY_INTERVAL) {
          lastDisplayRef.current = timestamp;
          setStatusText('Keep your head level');
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // EMA smoothing
      const s      = smoothedRef.current;
      const smooth = (a, b) => SMOOTH * a + (1 - SMOOTH) * b;
      const nextLeft     = Math.round(smooth(raw.left,     s.left));
      const nextRight    = Math.round(smooth(raw.right,    s.right));
      const nextStrength = Math.round(smooth(raw.strength, s.strength));

      // Symmetry: null below threshold; seed from raw on first valid frame.
      let nextSymmetry;
      if (raw.symmetry === null) {
        nextSymmetry = null;
      } else {
        const prev = s.symmetry ?? raw.symmetry;
        nextSymmetry = Math.round(smooth(raw.symmetry, prev));
      }

      const next = { left: nextLeft, right: nextRight, strength: nextStrength, symmetry: nextSymmetry };
      smoothedRef.current = next;

      // Throttle React state updates to ~30 fps
      if (timestamp - lastDisplayRef.current >= DISPLAY_INTERVAL) {
        lastDisplayRef.current = timestamp;
        const text = getEyebrowStatusText({ calibrating: false, faceDetected: true, ...next });
        setMetrics({ ...next });
        setStatusText(text);
        setDebugMetrics(raw.debug ?? null);
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

  // Face-lost status update without restarting the loop
  useEffect(() => {
    if (!isTracking || !baselineRef.current) return;
    if (!faceDetected) setStatusText('No face detected');
  }, [faceDetected, isTracking]);

  return { metrics, calibrating, statusText, debugMetrics };
}
