import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../config/appConfig';
import { getEnabledExercises, getExerciseById } from '../config/exercises';
import { useFaceTracking } from '../hooks/useFaceTracking';
import { useSmileMetrics } from '../hooks/useSmileMetrics';
import { useEyebrowMetrics } from '../hooks/useEyebrowMetrics';
import { drawLandmarkOverlay } from '../utils/smileMetrics';
import { drawEyebrowOverlay } from '../utils/eyebrowMetrics';
import WebcamPanel from '../components/WebcamPanel';
import MetricCard from '../components/MetricCard';
import styles from './FacialExercisePage.module.css';

const enabledExercises = getEnabledExercises();

const STATUS = {
  IDLE:     'idle',
  TRACKING: 'tracking',
  STOPPED:  'stopped',
};

const STATUS_LABEL = {
  [STATUS.IDLE]:     'Press start to begin',
  [STATUS.TRACKING]: 'Tracking\u2026',
  [STATUS.STOPPED]:  'Stopped',
};

/**
 * FacialExercisePage
 *
 * Renders the facial exercise practice interface with live smile tracking.
 *
 * Data flow:
 *   WebcamPanel (react-webcam) → webcamRef.current.video
 *     → useFaceTracking  (MediaPipe, 60 fps)  → landmarksRef, faceDetected
 *     → useSmileMetrics  (own RAF, ~30 fps UI) → left, right, strength, symmetry, statusText
 *     → overlay RAF loop (canvas drawing)
 */
export default function FacialExercisePage() {
  const [currentExerciseId, setCurrentExerciseId] = useState(
    () => enabledExercises[0]?.id ?? null,
  );
  const [sessionStatus, setSessionStatus] = useState(STATUS.IDLE);

  // Ref forwarded to WebcamPanel → react-webcam; video at webcamRef.current?.video
  const webcamRef  = useRef(null);
  // Ref for the canvas overlay drawn inside WebcamPanel
  const overlayRef = useRef(null);

  const activeExercise = getExerciseById(currentExerciseId);
  const isTracking     = sessionStatus === STATUS.TRACKING;

  // ── Face detection (MediaPipe) ──────────────────────────────────────────
  const {
    faceDetected,
    landmarksRef,
    isLoading: trackerLoading,
    error:     trackerError,
  } = useFaceTracking(webcamRef, isTracking);

  // ── Exercise metrics — each hook runs only when its exercise is active ──
  const {
    metrics:    smileMetrics,
    calibrating: smileCalibrating,
    statusText:  smileStatusText,
  } = useSmileMetrics(landmarksRef, isTracking && currentExerciseId === 'smile', faceDetected);

  const {
    metrics:     eyebrowMetrics,
    calibrating: eyebrowCalibrating,
    statusText:  eyebrowStatusText,
  } = useEyebrowMetrics(landmarksRef, isTracking && currentExerciseId === 'eyebrowRaise', faceDetected);

  const isEyebrow  = currentExerciseId === 'eyebrowRaise';
  const metrics    = isEyebrow ? eyebrowMetrics    : smileMetrics;
  const calibrating = isEyebrow ? eyebrowCalibrating : smileCalibrating;
  const statusText  = isEyebrow ? eyebrowStatusText  : smileStatusText;

  // ── Overlay drawing RAF ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!isTracking) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    let rafId;

    function drawFrame() {
      const cvs = overlayRef.current;
      if (!cvs) { rafId = requestAnimationFrame(drawFrame); return; }

      // Keep canvas resolution in sync with its CSS size
      const w = cvs.offsetWidth;
      const h = cvs.offsetHeight;
      if (cvs.width !== w || cvs.height !== h) {
        cvs.width  = w;
        cvs.height = h;
      }

      const ctx = cvs.getContext('2d');
      ctx.clearRect(0, 0, w, h);

      const landmarks = landmarksRef.current;
      if (landmarks) {
        if (currentExerciseId === 'eyebrowRaise') drawEyebrowOverlay(ctx, landmarks, w, h);
        else drawLandmarkOverlay(ctx, landmarks, w, h);
      }

      rafId = requestAnimationFrame(drawFrame);
    }

    rafId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafId);
  }, [isTracking, landmarksRef]);

  // ── Derived display values ───────────────────────────────────────────────
  function getFaceStatusValue() {
    if (!isTracking)    return STATUS_LABEL[sessionStatus];
    if (trackerLoading) return 'Loading face tracker\u2026';
    if (trackerError)   return 'Tracker unavailable';
    return statusText;                          // driven by active exercise hook
  }

  // Accent the wide Status card only when a face is found post-calibration
  const statusAccent = isTracking && !trackerLoading && !trackerError
                        && faceDetected && !calibrating;

  function handleStart() {
    setSessionStatus(STATUS.TRACKING);
  }

  function handleStop() {
    setSessionStatus(STATUS.STOPPED);
  }

  function handleNextExercise() {
    const currentIndex = enabledExercises.findIndex((e) => e.id === currentExerciseId);
    const nextIndex    = (currentIndex + 1) % enabledExercises.length;
    setCurrentExerciseId(enabledExercises[nextIndex].id);
    setSessionStatus(STATUS.IDLE);
  }

  if (!activeExercise) {
    return (
      <main className={styles.page}>
        <p className={styles.noExercises}>No exercises are currently available.</p>
        <Link to={ROUTES.HOME} className={styles.backLink}>← Home</Link>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to={ROUTES.HOME} className={styles.backLink}>← Home</Link>
        <h1 className={styles.title}>Facial Exercise</h1>
      </header>

      <div className={styles.layout}>
        {/* Left column: webcam feed */}
        <section className={styles.webcamColumn} aria-label="Webcam panel">
          <WebcamPanel webcamRef={webcamRef} overlayRef={overlayRef} isTracking={isTracking} />
        </section>

        {/* Right column: exercise info, metrics, controls */}
        <section className={styles.controlColumn} aria-label="Exercise controls">
          {/* Exercise instruction card */}
          <div className={styles.exerciseCard}>
            <span className={styles.exerciseLabel}>{activeExercise.label}</span>
            <p className={styles.instructionText}>{activeExercise.instructionText}</p>
          </div>

          {/* Metrics grid */}
          <div className={styles.metricsGrid} aria-label="Exercise metrics">
            <MetricCard label="Left"              value={isTracking && !calibrating ? String(metrics.left)     : '--'} />
            <MetricCard label="Right"             value={isTracking && !calibrating ? String(metrics.right)    : '--'} />
            <MetricCard label="Symmetry Score"    value={isTracking && !calibrating && metrics.symmetry !== null ? String(metrics.symmetry) : '--'} />
            <MetricCard label="Movement Strength" value={isTracking && !calibrating ? String(metrics.strength) : '--'} />
            <MetricCard
              label="Status"
              value={getFaceStatusValue()}
              accent={statusAccent}
              wide
            />
          </div>

          {/* Controls */}
          <div className={styles.controls}>
            <button
              type="button"
              className={isTracking ? styles.stopButton : styles.primaryButton}
              onClick={isTracking ? handleStop : handleStart}
            >
              {isTracking ? 'Stop' : 'Start'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleNextExercise}
              disabled={isTracking}
            >
              Next Exercise
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
