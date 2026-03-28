import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../config/appConfig';
import { useHandTracking } from '../hooks/useHandTracking';
import { useOpenHandMetrics } from '../hooks/useOpenHandMetrics';
import WebcamPanel from '../components/WebcamPanel';
import MetricCard from '../components/MetricCard';
import HandOverlay from '../components/HandOverlay';
import styles from './HandRecovery.module.css';

const EXERCISES = [
  {
    id:              'openHand',
    label:           'Open Hand',
    instructionText: 'Starting with a relaxed fist, slowly spread all your fingers as wide as you can. Hold for 2 seconds, then gently close your hand. Repeat 8 times.',
  },
  {
    id:              'closeHand',
    label:           'Close Hand',
    instructionText: 'Start with your hand open and fingers spread wide. Slowly curl your fingers inward to form a gentle fist. Hold for 2 seconds, then open again. Repeat 8 times.',
  },
  {
    id:              'holdPalmOpen',
    label:           'Hold Palm Open',
    instructionText: 'Extend your arm and open your hand fully with your palm facing forward. Hold this position for 10 seconds, keeping your fingers as straight and spread as comfortable.',
  },
];

const STATUS = { IDLE: 'idle', TRACKING: 'tracking', STOPPED: 'stopped' };

export default function HandRecovery() {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [sessionStatus, setSessionStatus] = useState(STATUS.IDLE);

  const webcamRef  = useRef(null);
  const overlayRef = useRef(null);

  const exercise   = EXERCISES[exerciseIndex];
  const isTracking = sessionStatus === STATUS.TRACKING;
  const isOpenHand = exercise.id === 'openHand';

  // ── Hand detection (MediaPipe Hands) ─────────────────────────────────────
  const {
    handDetected,
    landmarksRef,
    isLoading: handLoading,
    error:     handError,
  } = useHandTracking(webcamRef, isTracking);

  // ── Open Hand metrics (active only for the openHand exercise) ────────────
  const {
    metrics:    openHandMetrics,
    calibrating: openHandCalibrating,
    statusText:  openHandStatusText,
  } = useOpenHandMetrics(
    landmarksRef,
    isTracking && isOpenHand,
    handDetected,
  );

  // ── Derived display values ────────────────────────────────────────────────
  const calibrating     = isOpenHand ? openHandCalibrating : false;
  const showLiveMetrics = isTracking && isOpenHand && !calibrating && !handLoading && !handError;
  const statusAccent    = isTracking && !handLoading && !handError && handDetected && !calibrating;

  // isOpen for overlay colour — read directly from latest metrics when available
  const isOpen = showLiveMetrics && openHandMetrics.openClose >= 80 && openHandMetrics.fingerSpread >= 80;

  function getStatusValue() {
    if (!isTracking) {
      return sessionStatus === STATUS.STOPPED ? 'Session stopped' : 'Press start to begin';
    }
    if (handLoading)  return 'Loading hand tracker\u2026';
    if (handError)    return 'Hand tracker unavailable';
    if (isOpenHand)   return openHandStatusText;
    return 'Hand detection coming soon for this exercise';
  }

  function handleStart() { setSessionStatus(STATUS.TRACKING); }
  function handleStop()  { setSessionStatus(STATUS.STOPPED); }

  function handleNext() {
    setExerciseIndex((i) => (i + 1) % EXERCISES.length);
    setSessionStatus(STATUS.IDLE);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to={ROUTES.HOME} className={styles.backLink}>← Home</Link>
        <h1 className={styles.title}>Hand Recovery</h1>
      </header>

      <div className={styles.layout}>
        {/* Left column: webcam feed */}
        <section className={styles.webcamColumn} aria-label="Webcam panel">
          <WebcamPanel webcamRef={webcamRef} overlayRef={overlayRef} isTracking={isTracking} />
          <HandOverlay
            overlayRef={overlayRef}
            landmarksRef={landmarksRef}
            isTracking={isTracking && isOpenHand}
            isOpen={isOpen}
          />
          <p className={styles.cameraNote}>
            Hold your hand in front of the camera so it is clearly visible.
          </p>
        </section>

        {/* Right column: exercise info, metrics, controls */}
        <section className={styles.controlColumn} aria-label="Exercise controls">
          {/* Exercise info card */}
          <div className={styles.exerciseCard}>
            <span className={styles.exerciseLabel}>{exercise.label}</span>
            <p className={styles.instructionText}>{exercise.instructionText}</p>
          </div>

          {/* Metrics grid */}
          <div className={styles.metricsGrid} aria-label="Exercise metrics">
            <MetricCard
              label="Open / Close"
              value={showLiveMetrics ? String(openHandMetrics.openClose) : '--'}
            />
            <MetricCard
              label="Finger Spread"
              value={showLiveMetrics ? String(openHandMetrics.fingerSpread) : '--'}
            />
            <MetricCard
              label="Hold Time"
              value={showLiveMetrics ? `${openHandMetrics.holdTime}s` : '--'}
            />
            <MetricCard
              label="Steadiness"
              value={showLiveMetrics ? String(openHandMetrics.movementQuality) : '--'}
            />
            <MetricCard
              label="Status"
              value={getStatusValue()}
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
              onClick={handleNext}
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
