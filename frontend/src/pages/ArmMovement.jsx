import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../config/appConfig';
import { usePoseTracking } from '../hooks/usePoseTracking';
import { useRaiseRightArmMetrics } from '../hooks/useRaiseRightArmMetrics';
import WebcamPanel from '../components/WebcamPanel';
import MetricCard from '../components/MetricCard';
import PoseOverlay from '../components/PoseOverlay';
import styles from './ArmMovement.module.css';

const EXERCISES = [
  {
    id:              'raiseRight',
    label:           'Raise Right Arm',
    instructionText: 'Slowly raise your right arm out to the side until it reaches shoulder height. Hold for 3 seconds, then lower it back down. Repeat 5 times.',
  },
  {
    id:              'raiseLeft',
    label:           'Raise Left Arm',
    instructionText: 'Slowly raise your left arm out to the side until it reaches shoulder height. Hold for 3 seconds, then lower it back down. Repeat 5 times.',
  },
  {
    id:              'holdShoulder',
    label:           'Hold Arm at Shoulder Height',
    instructionText: 'Raise one arm to shoulder height and hold it steady for as long as comfortable. Focus on keeping the arm level and your shoulder relaxed.',
  },
];

const STATUS = { IDLE: 'idle', TRACKING: 'tracking', STOPPED: 'stopped' };

export default function ArmMovement() {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [sessionStatus, setSessionStatus] = useState(STATUS.IDLE);

  const webcamRef  = useRef(null);
  const overlayRef  = useRef(null);

  const exercise   = EXERCISES[exerciseIndex];
  const isTracking = sessionStatus === STATUS.TRACKING;
  const isRaiseRight = exercise.id === 'raiseRight';

  // ── Pose detection (MediaPipe Pose) ─────────────────────────────────────
  const {
    poseDetected,
    landmarksRef,
    isLoading: poseLoading,
    error:     poseError,
  } = usePoseTracking(webcamRef, isTracking);

  // ── Raise Right Arm metrics (active only for the raiseRight exercise) ───
  const {
    metrics:    raiseRightMetrics,
    calibrating: raiseRightCalibrating,
    statusText:  raiseRightStatusText,
  } = useRaiseRightArmMetrics(
    landmarksRef,
    isTracking && isRaiseRight,
    poseDetected,
  );

  // ── Derived display values ───────────────────────────────────────────────
  const calibrating = isRaiseRight ? raiseRightCalibrating : false;

  function getStatusValue() {
    if (!isTracking) {
      return sessionStatus === STATUS.STOPPED ? 'Session stopped' : 'Press start to begin';
    }
    if (poseLoading)  return 'Loading pose tracker\u2026';
    if (poseError)    return 'Pose tracker unavailable';
    if (isRaiseRight) return raiseRightStatusText;
    return 'Pose detection coming soon for this exercise';
  }

  const showLiveMetrics = isTracking && isRaiseRight && !calibrating && !poseLoading && !poseError;
  const statusAccent    = isTracking && !poseLoading && !poseError && poseDetected && !calibrating;

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
        <h1 className={styles.title}>Arm Movement</h1>
      </header>

      <div className={styles.layout}>
        {/* Left column: webcam feed */}
        <section className={styles.webcamColumn} aria-label="Webcam panel">
          <WebcamPanel webcamRef={webcamRef} overlayRef={overlayRef} isTracking={isTracking} />
          <PoseOverlay overlayRef={overlayRef} landmarksRef={landmarksRef} isTracking={isTracking && isRaiseRight} />
          <p className={styles.cameraNote}>
            Position yourself so your full upper body is visible in the camera.
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
              label="Height"
              value={showLiveMetrics ? String(raiseRightMetrics.height) : '--'}
            />
            <MetricCard
              label="Stability"
              value={showLiveMetrics ? String(raiseRightMetrics.stability) : '--'}
            />
            <MetricCard
              label="Hold Time"
              value={showLiveMetrics ? `${raiseRightMetrics.holdTime}s` : '--'}
            />
            <MetricCard
              label="Range of Motion"
              value={showLiveMetrics ? String(raiseRightMetrics.rangeOfMotion) : '--'}
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
