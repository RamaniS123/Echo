import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../config/appConfig';
import { useHandTracking } from '../hooks/useHandTracking';
import { useOpenHandMetrics } from '../hooks/useOpenHandMetrics';
import { useHoldPalmOpenMetrics } from '../hooks/useHoldPalmOpenMetrics';
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
    id:              'holdPalmOpen',
    label:           'Hold Palm Open',
    instructionText: 'First make a relaxed fist so the app can calibrate. Then extend your arm, open your hand fully with your palm facing forward, and hold for 8 seconds.',
  },
];

const STATUS = { IDLE: 'idle', TRACKING: 'tracking', STOPPED: 'stopped' };

export default function HandRecovery() {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [sessionStatus, setSessionStatus] = useState(STATUS.IDLE);

  const webcamRef  = useRef(null);
  const overlayRef = useRef(null);

  const exercise      = EXERCISES[exerciseIndex];
  const isTracking     = sessionStatus === STATUS.TRACKING;
  const isOpenHand     = exercise.id === 'openHand';
  const isHoldPalmOpen = exercise.id === 'holdPalmOpen';

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
  // ── Hold Palm Open metrics (active only for the holdPalmOpen exercise) ──
  const {
    metrics:    holdPalmMetrics,
    calibrating: holdPalmCalibrating,
    statusText:  holdPalmStatusText,
  } = useHoldPalmOpenMetrics(
    landmarksRef,
    isTracking && isHoldPalmOpen,
    handDetected,
  );
  // ── Derived display values ────────────────────────────────────────────────
  const calibrating     = isOpenHand ? openHandCalibrating : isHoldPalmOpen ? holdPalmCalibrating : false;
  const activeMetrics   = isOpenHand ? openHandMetrics : holdPalmMetrics;
  const showLiveMetrics = isTracking && (isOpenHand || isHoldPalmOpen) && !calibrating && !handLoading && !handError;
  const statusAccent    = isTracking && !handLoading && !handError && handDetected && !calibrating;

  // isOpen for overlay colour
  const isOpen = showLiveMetrics && activeMetrics.openClose >= 60 && activeMetrics.fingerSpread >= 50;

  function getStatusValue() {
    if (!isTracking) {
      return sessionStatus === STATUS.STOPPED ? 'Session stopped' : 'Press start to begin';
    }
    if (handLoading)      return 'Loading hand tracker…';
    if (handError)        return 'Hand tracker unavailable';
    if (isOpenHand)       return openHandStatusText;
    if (isHoldPalmOpen)   return holdPalmStatusText;
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
            isTracking={isTracking && (isOpenHand || isHoldPalmOpen)}
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
              value={showLiveMetrics ? String(activeMetrics.openClose) : '--'}
            />
            <MetricCard
              label="Finger Spread"
              value={showLiveMetrics ? String(activeMetrics.fingerSpread) : '--'}
            />
            <MetricCard
              label="Hold Time"
              value={showLiveMetrics ? `${activeMetrics.holdTime}s` : '--'}
            />
            <MetricCard
              label="Steadiness"
              value={showLiveMetrics ? String(activeMetrics.movementQuality) : '--'}
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
