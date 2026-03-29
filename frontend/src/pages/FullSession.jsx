import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES }                    from '../config/appConfig';
import { useFaceTracking }           from '../hooks/useFaceTracking';
import { usePoseTracking }           from '../hooks/usePoseTracking';
import { useHandTracking }           from '../hooks/useHandTracking';
import { useSmileMetrics }           from '../hooks/useSmileMetrics';
import { useRaiseRightArmMetrics }   from '../hooks/useRaiseRightArmMetrics';
import { useOpenHandMetrics }        from '../hooks/useOpenHandMetrics';
import WebcamPanel  from '../components/WebcamPanel';
import PoseOverlay  from '../components/PoseOverlay';
import HandOverlay  from '../components/HandOverlay';
import MetricCard   from '../components/MetricCard';
import { speak }    from '../utils/tts';
import styles       from './FullSession.module.css';

// ─── Session exercise sequence ─────────────────────────────────────────────

const SESSION_STEPS = [
  {
    id:              'smile',
    category:        'Facial Recovery',
    exercise:        'Smile',
    instructionText: 'Hold still while the app calibrates, then smile as wide and symmetrically as you can and hold it.',
    categoryTag:     'facial',
  },
  {
    id:              'raiseRightArm',
    category:        'Arm Movement',
    exercise:        'Raise Right Arm',
    instructionText: 'Stand with arms relaxed at your sides while the app calibrates, then slowly raise your right arm to shoulder height and hold for 3 seconds.',
    categoryTag:     'arm',
  },
  {
    id:              'openHand',
    category:        'Hand Recovery',
    exercise:        'Open Hand',
    instructionText: 'Make a relaxed fist while the app calibrates, then slowly spread all your fingers as wide as you can and hold for 2 seconds.',
    categoryTag:     'hand',
  },
];

const CATEGORY_COLOUR = {
  facial: styles.tagFacial,
  arm:    styles.tagArm,
  hand:   styles.tagHand,
};

/** Smile is held at or above this strength (0–100) to count as "smiling". */
const SMILE_STRENGTH_THRESHOLD = 60;
/** How long (ms) the smile must be held before the step is complete. */
const SMILE_HOLD_MS = 3000;
/** Pause (ms) showing "Step complete!" before auto-advancing. */
const TRANSITION_DELAY_MS = 1500;

// ─── Component ────────────────────────────────────────────────────────────

export default function FullSession() {
  const [stepIndex,      setStepIndex]      = useState(0);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [transitioning,  setTransitioning]  = useState(false);
  const [sessionDone,    setSessionDone]    = useState(false);

  const webcamRef  = useRef(null);
  const overlayRef = useRef(null);

  const step        = SESSION_STEPS[stepIndex];
  const isSmileStep = step.id === 'smile';
  const isArmStep   = step.id === 'raiseRightArm';
  const isHandStep  = step.id === 'openHand';

  // ── Trackers — each initialises its model once on mount ─────────────────
  // isTracking is gated to the active step so only one tracker processes
  // frames at a time, keeping resource use low.
  const { faceDetected, landmarksRef: faceLandmarksRef, isLoading: faceLoading } =
    useFaceTracking(webcamRef, sessionStarted && isSmileStep);

  const { poseDetected, landmarksRef: poseLandmarksRef, isLoading: poseLoading } =
    usePoseTracking(webcamRef, sessionStarted && isArmStep);

  const { handDetected, landmarksRef: handLandmarksRef, isLoading: handLoading } =
    useHandTracking(webcamRef, sessionStarted && isHandStep);

  // ── Exercise metric hooks — gated per step ────────────────────────────────
  const {
    metrics:    smileMetrics,
    calibrating: smileCalibrating,
    statusText:  smileStatus,
  } = useSmileMetrics(faceLandmarksRef, sessionStarted && isSmileStep, faceDetected);

  const {
    metrics:    armMetrics,
    calibrating: armCalibrating,
    statusText:  armStatus,
  } = useRaiseRightArmMetrics(poseLandmarksRef, sessionStarted && isArmStep, poseDetected);

  const {
    metrics:    openHandMetrics,
    calibrating: openHandCalibrating,
    statusText:  openHandStatus,
  } = useOpenHandMetrics(handLandmarksRef, sessionStarted && isHandStep, handDetected);

  // ── Smile hold timer (tracked here — smile has no terminal status text) ──
  const smileHoldStartRef   = useRef(null);
  // Guard: prevents multiple transitions firing while setTimeout is pending
  const transitionFiredRef  = useRef(false);
  // Ref for the pending advance timer — so cleanup on re-render doesn't cancel it
  const transitionTimerRef  = useRef(null);

  // ── TTS spoken-once flags (reset on restart) ─────────────────────────────
  const spokenRef = useRef({
    welcome:   false,
    smile:     false,
    arm:       false,
    hand:      false,
    complete:  false,
  });

  // Cleanup the advance timer on unmount only
  useEffect(() => () => clearTimeout(transitionTimerRef.current), []);

  // ── TTS: welcome + per-step intro ─────────────────────────────────────────
  // Welcome fires on start and includes the first exercise instruction so
  // there is only ever one clip playing at session launch.
  useEffect(() => {
    if (!sessionStarted) return;
    if (!spokenRef.current.welcome) {
      spokenRef.current.welcome = true;
      spokenRef.current.smile   = true; // already covered by the welcome message
      speak("Welcome to Echo. Let's begin your recovery session. First, smile as evenly as you can.");
    }
  }, [sessionStarted]);

  // Subsequent step intros fire when the step index advances (never on step 0).
  useEffect(() => {
    if (!sessionStarted) return;
    if (isArmStep && !spokenRef.current.arm) {
      spokenRef.current.arm = true;
      speak('Great job. Stand with your arms relaxed at your sides while the app calibrates, then raise your right arm.');
    }
    if (isHandStep && !spokenRef.current.hand) {
      spokenRef.current.hand = true;
      speak('Nice work. Make a relaxed fist while the app calibrates, then open your hand.');
    }
  }, [sessionStarted, isArmStep, isHandStep]);

  // ── Auto-transition: watch completion signals and advance automatically ───
  useEffect(() => {
    if (!sessionStarted || transitioning || sessionDone || transitionFiredRef.current) return;

    let isComplete = false;

    if (isSmileStep && !smileCalibrating) {
      const isSmiling = smileMetrics.strength >= SMILE_STRENGTH_THRESHOLD;
      if (isSmiling) {
        if (smileHoldStartRef.current === null) smileHoldStartRef.current = Date.now();
        isComplete = (Date.now() - smileHoldStartRef.current) >= SMILE_HOLD_MS;
      } else {
        smileHoldStartRef.current = null;
      }
    }

    if (isArmStep)  isComplete = armStatus.includes('Great job');
    if (isHandStep) isComplete = openHandStatus.includes('Great job');

    if (!isComplete) return;

    // Lock so this effect can't fire the transition again while pending
    transitionFiredRef.current = true;
    setTransitioning(true);

    // Store timer in a ref — returning cleanup here would cancel it on every re-render
    transitionTimerRef.current = setTimeout(() => {
      if (stepIndex >= SESSION_STEPS.length - 1) {
        setSessionDone(true);
        if (!spokenRef.current.complete) {
          spokenRef.current.complete = true;
          speak('Session complete. Great job today.');
        }
      } else {
        setStepIndex((i) => i + 1);
        smileHoldStartRef.current = null;
      }
      setTransitioning(false);
      transitionFiredRef.current = false;
    }, TRANSITION_DELAY_MS);
  }, [
    sessionStarted, transitioning, sessionDone,
    isSmileStep, smileCalibrating, smileMetrics.strength,
    isArmStep,  armStatus,
    isHandStep, openHandStatus,
    stepIndex,
  ]);

  // ── Derived display values ────────────────────────────────────────────────
  const activeLoading  = isSmileStep ? faceLoading : isArmStep ? poseLoading : handLoading;
  const activeStatus   = isSmileStep ? smileStatus : isArmStep ? armStatus   : openHandStatus;
  const isHandOpen     = isHandStep && openHandMetrics.openClose >= 55;
  const showSmileMetrics = sessionStarted && isSmileStep && !smileCalibrating && !faceLoading;
  const showArmMetrics   = sessionStarted && isArmStep  && !armCalibrating   && !poseLoading;
  const showHandMetrics  = sessionStarted && isHandStep && !openHandCalibrating && !handLoading;
  function statusCardValue() {
    if (!sessionStarted)  return 'Press Start Session to begin';
    if (activeLoading)    return 'Loading tracker\u2026';
    if (transitioning)    return 'Step complete \u2014 moving on\u2026';
    return activeStatus;
  }

  function handleStart()   { setSessionStarted(true); }

  function handleRestart() {
    setStepIndex(0);
    setSessionStarted(false);
    setTransitioning(false);
    setSessionDone(false);
    smileHoldStartRef.current  = null;
    transitionFiredRef.current = false;
    spokenRef.current = { welcome: false, smile: false, arm: false, hand: false, complete: false };
  }

  // ── Session complete screen ───────────────────────────────────────────────
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
            Great work! You completed all {SESSION_STEPS.length} of {SESSION_STEPS.length} exercises.
            Take a moment to rest before your next session.
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

  // ── Main session UI ───────────────────────────────────────────────────────
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to={ROUTES.HOME} className={styles.backLink}>← Home</Link>
        <h1 className={styles.title}>Full Session</h1>
      </header>

      {/* Progress stepper */}
      <div className={styles.progressBar} aria-label="Session progress">
        {SESSION_STEPS.map((s, i) => (
          <div key={s.id} className={styles.progressItem}>
            <div
              className={[
                styles.progressDot,
                i < stepIndex  ? styles.progressDotDone   : '',
                i === stepIndex ? styles.progressDotActive : '',
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
        {/* Webcam column */}
        <section className={styles.webcamColumn} aria-label="Webcam panel">
          <WebcamPanel webcamRef={webcamRef} overlayRef={overlayRef} isTracking={sessionStarted} />

          {/* Arm overlay — only active for Raise Right Arm step */}
          <PoseOverlay
            overlayRef={overlayRef}
            landmarksRef={poseLandmarksRef}
            isTracking={sessionStarted && isArmStep}
            side="right"
          />

          {/* Hand overlay — only active for Open Hand step */}
          <HandOverlay
            overlayRef={overlayRef}
            landmarksRef={handLandmarksRef}
            isTracking={sessionStarted && isHandStep}
            isOpen={isHandOpen}
          />
        </section>

        {/* Control column */}
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

          {/* Metrics grid — content varies per step */}
          <div className={styles.metricsGrid} aria-label="Exercise metrics">

            {/* Smile metrics */}
            {isSmileStep && (
              <>
                <MetricCard label="Left"              value={showSmileMetrics ? String(smileMetrics.left)     : '--'} />
                <MetricCard label="Right"             value={showSmileMetrics ? String(smileMetrics.right)    : '--'} />
                <MetricCard label="Symmetry Score"    value={showSmileMetrics && smileMetrics.symmetry !== null ? String(smileMetrics.symmetry) : '--'} />
                <MetricCard label="Movement Strength" value={showSmileMetrics ? String(smileMetrics.strength) : '--'} />
              </>
            )}

            {/* Arm metrics */}
            {isArmStep && (
              <>
                <MetricCard label="Height"         value={showArmMetrics ? String(armMetrics.height)        : '--'} />
                <MetricCard label="Stability"       value={showArmMetrics ? String(armMetrics.stability)     : '--'} />
                <MetricCard label="Hold Time"       value={showArmMetrics ? `${armMetrics.holdTime}s`        : '--'} />
                <MetricCard label="Range of Motion" value={showArmMetrics ? String(armMetrics.rangeOfMotion) : '--'} />
              </>
            )}

            {/* Hand metrics */}
            {isHandStep && (
              <>
                <MetricCard label="Open / Close"  value={showHandMetrics ? String(openHandMetrics.openClose)      : '--'} />
                <MetricCard label="Finger Spread" value={showHandMetrics ? String(openHandMetrics.fingerSpread)   : '--'} />
                <MetricCard label="Hold Time"     value={showHandMetrics ? `${openHandMetrics.holdTime}s`         : '--'} />
                <MetricCard label="Steadiness"    value={showHandMetrics ? String(openHandMetrics.movementQuality): '--'} />
              </>
            )}

            {/* Status — always shown */}
            <MetricCard
              label="Status"
              value={statusCardValue()}
              accent={sessionStarted && !activeLoading && !transitioning}
              wide
            />
          </div>

          {/* Controls — only Start is needed; session is hands-free after that */}
          <div className={styles.controls}>
            {!sessionStarted && (
              <button type="button" className={styles.primaryButton} onClick={handleStart}>
                Start Session
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
