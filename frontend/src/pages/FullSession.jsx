import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../config/appConfig';
import MetricCard from '../components/MetricCard';
import styles from './FullSession.module.css';

const SESSION_STEPS = [
  {
    category:        'Facial Recovery',
    exercise:        'Smile',
    instructionText: 'Smile as wide and symmetrically as you can. Hold for 2 seconds, then relax. Repeat 5 times.',
    categoryTag:     'facial',
  },
  {
    category:        'Arm Movement',
    exercise:        'Raise Right Arm',
    instructionText: 'Slowly raise your right arm out to shoulder height. Hold for 3 seconds, then lower it. Repeat 5 times.',
    categoryTag:     'arm',
  },
  {
    category:        'Hand Recovery',
    exercise:        'Open Hand',
    instructionText: 'Open your hand slowly, spreading all fingers as wide as comfortable. Hold for 2 seconds, then close. Repeat 8 times.',
    categoryTag:     'hand',
  },
];

const STEP_STATUS = { IDLE: 'idle', ACTIVE: 'active', DONE: 'done' };

const CATEGORY_COLOUR = {
  facial: styles.tagFacial,
  arm:    styles.tagArm,
  hand:   styles.tagHand,
};

export default function FullSession() {
  const [stepIndex,   setStepIndex]   = useState(0);
  const [stepStatus,  setStepStatus]  = useState(STEP_STATUS.IDLE);
  const [sessionDone, setSessionDone] = useState(false);

  const step       = SESSION_STEPS[stepIndex];
  const isActive   = stepStatus === STEP_STATUS.ACTIVE;
  const isLastStep = stepIndex === SESSION_STEPS.length - 1;

  function handleStart() {
    setStepStatus(STEP_STATUS.ACTIVE);
  }

  function handleStepDone() {
    setStepStatus(STEP_STATUS.DONE);
  }

  function handleNext() {
    if (isLastStep) {
      setSessionDone(true);
    } else {
      setStepIndex((i) => i + 1);
      setStepStatus(STEP_STATUS.IDLE);
    }
  }

  function handleRestart() {
    setStepIndex(0);
    setStepStatus(STEP_STATUS.IDLE);
    setSessionDone(false);
  }

  if (sessionDone) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <Link to={ROUTES.HOME} className={styles.backLink}>← Home</Link>
          <h1 className={styles.title}>Full Session</h1>
        </header>

        <div className={styles.completeCard}>
          <div className={styles.completeIcon} aria-hidden="true">✓</div>
          <h2 className={styles.completeHeading}>Session Complete</h2>
          <p className={styles.completeText}>
            Great work. You completed all three exercises for today. Take a moment to rest before your next session.
          </p>
          <div className={styles.completeActions}>
            <button type="button" className={styles.primaryButton} onClick={handleRestart}>
              Start Again
            </button>
            <Link to={ROUTES.HOME} className={styles.secondaryButtonLink}>
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to={ROUTES.HOME} className={styles.backLink}>← Home</Link>
        <h1 className={styles.title}>Full Session</h1>
      </header>

      {/* Step progress indicator */}
      <div className={styles.progressBar} aria-label="Session progress">
        {SESSION_STEPS.map((s, i) => (
          <div key={s.exercise} className={styles.progressItem}>
            <div
              className={[
                styles.progressDot,
                i < stepIndex             ? styles.progressDotDone    : '',
                i === stepIndex           ? styles.progressDotActive  : '',
              ].join(' ')}
              aria-current={i === stepIndex ? 'step' : undefined}
            />
            <span className={`${styles.progressLabel} ${i === stepIndex ? styles.progressLabelActive : ''}`}>
              {s.category}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.layout}>
        {/* Left: webcam placeholder */}
        <section className={styles.webcamColumn} aria-label="Camera placeholder">
          <div className={styles.camPlaceholder}>
            <span className={styles.camIcon} aria-hidden="true">📷</span>
            <span className={styles.camMessage}>Camera feed will appear here when tracking is active</span>
          </div>
        </section>

        {/* Right: step card + metrics + controls */}
        <section className={styles.controlColumn} aria-label="Session controls">
          {/* Step info card */}
          <div className={styles.stepCard}>
            <div className={styles.stepMeta}>
              <span className={`${styles.categoryTag} ${CATEGORY_COLOUR[step.categoryTag]}`}>
                {step.category}
              </span>
              <span className={styles.stepCounter}>
                Step {stepIndex + 1} of {SESSION_STEPS.length}
              </span>
            </div>
            <span className={styles.exerciseLabel}>{step.exercise}</span>
            <p className={styles.instructionText}>{step.instructionText}</p>
          </div>

          {/* Status metric */}
          <div className={styles.metricsGrid}>
            <MetricCard
              label="Status"
              value={
                isActive
                  ? 'Exercise in progress'
                  : stepStatus === STEP_STATUS.DONE
                  ? 'Step complete — ready for next'
                  : 'Press Start when ready'
              }
              accent={isActive}
              wide
            />
          </div>

          {/* Controls */}
          <div className={styles.controls}>
            {stepStatus === STEP_STATUS.IDLE && (
              <button type="button" className={styles.primaryButton} onClick={handleStart}>
                Start
              </button>
            )}
            {stepStatus === STEP_STATUS.ACTIVE && (
              <button type="button" className={styles.stopButton} onClick={handleStepDone}>
                Mark Done
              </button>
            )}
            {stepStatus === STEP_STATUS.DONE && (
              <button type="button" className={styles.primaryButton} onClick={handleNext}>
                {isLastStep ? 'Finish Session' : 'Next Step'}
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
