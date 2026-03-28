import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../config/appConfig';
import WebcamPanel from '../components/WebcamPanel';
import MetricCard from '../components/MetricCard';
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

  const exercise  = EXERCISES[exerciseIndex];
  const isTracking = sessionStatus === STATUS.TRACKING;

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
          <WebcamPanel isTracking={isTracking} />
          <p className={styles.cameraNote}>Pose tracking coming soon — position yourself so your full upper body is visible.</p>
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
            <MetricCard label="Height"           value="--" />
            <MetricCard label="Stability"        value="--" />
            <MetricCard label="Hold Time"        value="--" />
            <MetricCard label="Range of Motion"  value="--" />
            <MetricCard
              label="Status"
              value={
                isTracking
                  ? 'Tracking active — pose detection coming soon'
                  : sessionStatus === STATUS.STOPPED
                  ? 'Session stopped'
                  : 'Press start to begin'
              }
              accent={isTracking}
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
