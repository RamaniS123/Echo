import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../config/appConfig';
import { getEnabledExercises, getExerciseById } from '../config/exercises';
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
 * Renders the facial exercise practice interface.
 *
 * Exercise state is driven by `currentExerciseId`. The active exercise object
 * is always derived via `getExerciseById` — the page never indexes the array directly.
 *
 * All metric values are placeholders (0 / "--").
 * MediaPipe integration will update these via a custom hook.
 */
export default function FacialExercisePage() {
  const [currentExerciseId, setCurrentExerciseId] = useState(
    () => enabledExercises[0]?.id ?? null,
  );
  const [sessionStatus, setSessionStatus] = useState(STATUS.IDLE);

  const activeExercise = getExerciseById(currentExerciseId);
  const isTracking = sessionStatus === STATUS.TRACKING;

  // Placeholder metrics — driven by useFaceTracking hook in a future iteration
  const metrics = [
    { id: 'left',             label: 'Left',              value: '0' },
    { id: 'right',            label: 'Right',             value: '0' },
    { id: 'symmetryScore',    label: 'Symmetry Score',    value: '--' },
    { id: 'movementStrength', label: 'Movement Strength', value: '--' },
  ];

  function handleStart() {
    setSessionStatus(STATUS.TRACKING);
  }

  function handleStop() {
    setSessionStatus(STATUS.STOPPED);
  }

  function handleNextExercise() {
    const currentIndex = enabledExercises.findIndex((e) => e.id === currentExerciseId);
    const nextIndex = (currentIndex + 1) % enabledExercises.length;
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
          <WebcamPanel isTracking={isTracking} />
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
            {metrics.map((m) => (
              <MetricCard key={m.id} label={m.label} value={m.value} />
            ))}
            <MetricCard
              label="Status"
              value={STATUS_LABEL[sessionStatus]}
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
