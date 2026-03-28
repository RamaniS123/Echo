import { useEffect, useRef, useState } from 'react';
import {
  captureLeftArmBaselineSample,
  averageArmBaseline,
  computeRaiseLeftArmMetrics,
  areLandmarksValidLeft,
  getRaiseLeftArmStatusText,
  SMOOTH,
  HOLD_DURATION_MS,
  STABILITY_JITTER_THRESHOLD,
} from '../utils/armMovementMetrics';

/** Number of valid pose frames to collect before locking baseline (~1 s at 30 fps). */
const CALIBRATION_FRAMES = 40;

/** Rolling window for 2-D wrist-movement stability (number of frame distances). */
const STABILITY_WINDOW = 20;

/** Cap React state updates to ~25 fps to keep renders light. */
const DISPLAY_INTERVAL = 1000 / 25;

const ZERO_METRICS = { height: 0, stability: 100, holdTime: 0, rangeOfMotion: 0 };

/**
 * useRaiseLeftArmMetrics
 *
 * Drives the calibration phase and real-time metric computation for the
 * "Raise Left Arm" exercise.  Mirrors useRaiseRightArmMetrics exactly but
 * operates on left-arm landmarks (LEFT_SHOULDER=11, LEFT_ELBOW=13, LEFT_WRIST=15).
 *
 * @param {React.RefObject} landmarksRef   — from usePoseTracking (.current = 33-pt array | null)
 * @param {boolean}         isTracking
 * @param {boolean}         poseDetected
 *
 * @returns {{ metrics, calibrating, statusText }}
 */
export function useRaiseLeftArmMetrics(landmarksRef, isTracking, poseDetected) {
  const [calibrating, setCalibrating] = useState(false);
  const [metrics,     setMetrics]     = useState(ZERO_METRICS);
  const [statusText,  setStatusText]  = useState('Press start to begin');

  const baselineRef        = useRef(null);
  const baselineSamplesRef = useRef([]);
  const smoothedRef        = useRef({ ...ZERO_METRICS });
  const rafRef             = useRef(null);
  const lastDisplayRef     = useRef(0);

  // Hold time tracking
  const holdStartRef    = useRef(null);
  const holdMsRef       = useRef(0);

  // 2-D stability: frame-to-frame Euclidean wrist movement
  const prevWristRef      = useRef(null);
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
      prevWristRef.current       = null;
      frameDistancesRef.current  = [];
      lastDisplayRef.current     = 0;
      setCalibrating(false);
      setMetrics(ZERO_METRICS);
      setStatusText('Press start to begin');
      return;
    }

    // Kick off calibration phase
    baselineRef.current        = null;
    baselineSamplesRef.current = [];
    smoothedRef.current        = { ...ZERO_METRICS };
    holdStartRef.current       = null;
    holdMsRef.current          = 0;
    prevWristRef.current       = null;
    frameDistancesRef.current  = [];
    setCalibrating(true);
    setStatusText('Hold still to calibrate\u2026');

    function tick(timestamp) {
      const landmarks = landmarksRef.current;

      // ── No landmarks at all ──────────────────────────────────────────────────
      if (!landmarks) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // ── Landmarks present but low confidence ─────────────────────────────────
      if (!areLandmarksValidLeft(landmarks)) {
        if (timestamp - lastDisplayRef.current >= DISPLAY_INTERVAL) {
          lastDisplayRef.current = timestamp;
          setStatusText('Stand clearly in frame');
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // ── Calibration ──────────────────────────────────────────────────────────
      if (!baselineRef.current) {
        baselineSamplesRef.current.push(captureLeftArmBaselineSample(landmarks));

        if (baselineSamplesRef.current.length >= CALIBRATION_FRAMES) {
          baselineRef.current = averageArmBaseline(baselineSamplesRef.current);
          setCalibrating(false);
          setStatusText('Raise your left arm higher');
        }

        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // ── Tracking ─────────────────────────────────────────────────────────────
      const raw = computeRaiseLeftArmMetrics(landmarks, baselineRef.current);

      // ── Hold time ────────────────────────────────────────────────────────────
      if (raw.isAboveTarget) {
        if (holdStartRef.current === null) holdStartRef.current = timestamp;
        holdMsRef.current = timestamp - holdStartRef.current;
      } else {
        holdStartRef.current = null;
        holdMsRef.current    = 0;
      }
      const holdMs = holdMsRef.current;

      // ── 2-D Stability: avg frame-to-frame Euclidean wrist movement ───────────
      const curPos = [raw.rawWristX, raw.rawWristY];
      let frameDist = 0;
      if (prevWristRef.current) {
        const dx = curPos[0] - prevWristRef.current[0];
        const dy = curPos[1] - prevWristRef.current[1];
        frameDist = Math.sqrt(dx * dx + dy * dy);
      }
      prevWristRef.current = curPos;

      const dists = frameDistancesRef.current;
      dists.push(frameDist);
      if (dists.length > STABILITY_WINDOW) dists.shift();

      let stability = 100;
      if (dists.length >= 3) {
        const avgDist = dists.reduce((t, d) => t + d, 0) / dists.length;
        stability = Math.round(Math.max(0, Math.min(100,
          100 * (1 - avgDist / STABILITY_JITTER_THRESHOLD),
        )));
      }

      // ── EMA smoothing ─────────────────────────────────────────────────────────
      const s      = smoothedRef.current;
      const smooth = (a, b) => SMOOTH * a + (1 - SMOOTH) * b;

      const next = {
        height:        Math.round(smooth(raw.height,        s.height)),
        stability:     Math.round(smooth(stability,         s.stability)),
        holdTime:      Math.round(holdMs / 1000 * 10) / 10,
        rangeOfMotion: Math.round(smooth(raw.rangeOfMotion, s.rangeOfMotion)),
      };
      smoothedRef.current = next;

      // ── Throttle React state updates ──────────────────────────────────────────
      if (timestamp - lastDisplayRef.current >= DISPLAY_INTERVAL) {
        lastDisplayRef.current = timestamp;
        const text = getRaiseLeftArmStatusText({
          noPose:        false,
          calibrating:   false,
          isAboveTarget: raw.isAboveTarget,
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

  // Pose-lost status: when poseDetected flips to false the tick loop keeps running
  // but landmarks will be null so it can't update state — update here instead.
  useEffect(() => {
    if (!isTracking || !baselineRef.current) return;
    if (!poseDetected) setStatusText('No body detected');
  }, [poseDetected, isTracking]);

  return { metrics, calibrating, statusText };
}
