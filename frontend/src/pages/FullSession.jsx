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

// ─── Mini-goal constants (tune these for demo) ────────────────────────────

/** Minimum smile strength (0–100) to count as smiling. Observable max is ~35–40. */
const SMILE_STRENGTH_THRESHOLD  = 25;
/** How long the smile must be held above threshold before the step completes. */
const SMILE_HOLD_DURATION_MS    = 4000;
/** Arm hold is enforced inside useRaiseRightArmMetrics — 3000 ms. */
const ARM_HOLD_DURATION_MS      = 5000; // eslint-disable-line no-unused-vars
/** Hand hold is enforced inside useOpenHandMetrics — 2000 ms. */
const HAND_HOLD_DURATION_MS     = 5000; // eslint-disable-line no-unused-vars
/** Pause showing "Step complete" before auto-advancing. */
const TRANSITION_DELAY_MS       = 1500;

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
    welcome:        false, // intro message on Start
    smileIntro:     false, // exercise instruction
    smileHold:      false, // fired once when smile target is first reached
    armIntro:       false,
    armHold:        false,
    handIntro:      false,
    handHold:       false,
    complete:       false,
  });

  // Cleanup transition timer on unmount only
  useEffect(() => () => clearTimeout(transitionTimerRef.current), []);

  // ── TTS: welcome plays on page load, before Start is pressed ─────────────────
  // Module-level flag prevents StrictMode double-invocation from playing twice.
  useEffect(() => {
    if (spokenRef.current.welcome) return;
    spokenRef.current.welcome = true;
    speak("Welcome to Echo. Please press Start when you're ready to begin your session.");
  }, []); // runs once on mount

  // ── TTS: first exercise instruction fires when Start is pressed ─────────────
  useEffect(() => {
    if (!sessionStarted || spokenRef.current.smileIntro) return;
    spokenRef.current.smileIntro = true;
    speak('Let\'s begin. Smile as evenly as you can and hold it for four seconds.');
  }, [sessionStarted]);

  // ── TTS: exercise intros (steps 2 and 3) ──────────────────────────────
  useEffect(() => {
    if (!sessionStarted) return;
    if (isArmStep && !spokenRef.current.armIntro) {
      spokenRef.current.armIntro = true;
      speak('Now, stand with your arms relaxed at your sides while the app calibrates. Then raise your right arm and hold it steady for five seconds.');
    }
    if (isHandStep && !spokenRef.current.handIntro) {
      spokenRef.current.handIntro = true;
      speak('Almost done. Make a relaxed fist while the app calibrates. Then open your hand and hold it open for five seconds.');
    }
  }, [sessionStarted, isArmStep, isHandStep]);

  // ── TTS: hold-phase cues — fire at the instant the target is first reached ──
  // Triggered on raw metric threshold so ElevenLabs has ~1–2 s of latency budget
  // before the hold window closes. Each flag ensures one play per step.
  useEffect(() => {
    if (!sessionStarted || smileCalibrating) return;
    const smiling = smileMetrics.strength >= SMILE_STRENGTH_THRESHOLD;
    if (isSmileStep && smiling && !spokenRef.current.smileHold) {
      spokenRef.current.smileHold = true;
      speak('Good, hold that smile.');
    }
  }, [sessionStarted, isSmileStep, smileCalibrating, smileMetrics.strength]);

  useEffect(() => {
    if (!sessionStarted || armCalibrating) return;
    // Fire as soon as the arm clears the target — armStatus stops saying 'Raise'
    const armReachedTarget = armStatus.includes('Good height') || armStatus.includes('Hold') || armStatus.includes('Great job');
    if (isArmStep && armReachedTarget && !spokenRef.current.armHold) {
      spokenRef.current.armHold = true;
      speak('Good, keep it steady.');
    }
  }, [sessionStarted, isArmStep, armCalibrating, armStatus]);

  useEffect(() => {
    if (!sessionStarted || openHandCalibrating) return;
    // Fire as soon as openClose crosses the threshold (same moment the hold timer starts)
    const handReachedTarget = openHandMetrics.openClose >= 22;
    if (isHandStep && handReachedTarget && !spokenRef.current.handHold) {
      spokenRef.current.handHold = true;
      speak('Good, keep your hand open.');
    }
  }, [sessionStarted, isHandStep, openHandCalibrating, openHandMetrics.openClose]);

  // ── Auto-transition: watch completion signals and advance automatically ───
  useEffect(() => {
    if (!sessionStarted || transitioning || sessionDone || transitionFiredRef.current) return;

    let isComplete = false;

    if (isSmileStep && !smileCalibrating) {
      const isSmiling = smileMetrics.strength >= SMILE_STRENGTH_THRESHOLD;
      if (isSmiling) {
        if (smileHoldStartRef.current === null) smileHoldStartRef.current = Date.now();
        isComplete = (Date.now() - smileHoldStartRef.current) >= SMILE_HOLD_DURATION_MS;
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
    // Use a longer delay on steps where a hold cue may still be playing
    const isFinalStep = stepIndex >= SESSION_STEPS.length - 1;
    const delay = (isFinalStep || isArmStep) ? 4000 : TRANSITION_DELAY_MS;
    transitionTimerRef.current = setTimeout(() => {
      if (isFinalStep) {
        if (!spokenRef.current.complete) {
          spokenRef.current.complete = true;
          speak('Session complete. Great job today.');
        }
        setSessionDone(true);
      } else {
        setStepIndex((i) => i + 1);
        smileHoldStartRef.current = null;
      }
      setTransitioning(false);
      transitionFiredRef.current = false;
    }, delay);
  }, [
    sessionStarted, transitioning, sessionDone,
    isSmileStep, smileCalibrating, smileMetrics.strength,
    isArmStep,  armStatus,
    isHandStep, openHandStatus,
    stepIndex,
  ]);

  // ── Derived display values ────────────────────────────────────────────────
  const activeLoading  = isSmileStep ? faceLoading : isArmStep ? poseLoading : handLoading;
  const isHandOpen     = isHandStep && openHandMetrics.openClose >= 22;
  const showSmileMetrics = sessionStarted && isSmileStep && !smileCalibrating && !faceLoading;
  const showArmMetrics   = sessionStarted && isArmStep  && !armCalibrating   && !poseLoading;
  const showHandMetrics  = sessionStarted && isHandStep && !openHandCalibrating && !handLoading;

  /** Returns a meaningful, step-specific status string for the Status card. */
  function getStepStatus() {
    if (!sessionStarted) return 'Press Start Session to begin';
    if (activeLoading)   return 'Loading tracker…';
    if (transitioning)   return 'Step complete — moving on…';

    if (isSmileStep) {
      if (smileCalibrating) return smileStatus;
      if (smileMetrics.strength >= SMILE_STRENGTH_THRESHOLD) return 'Good — hold your smile…';
      return 'Smile as evenly as you can';
    }

    if (isArmStep) {
      if (armCalibrating) return armStatus;
      if (armStatus.includes('No body') || armStatus.includes('Raise')) return 'Raise your right arm';
      if (armStatus.includes('Great job')) return 'Great job!';
      return 'Good height — hold your arm steady';
    }

    if (isHandStep) {
      if (openHandCalibrating) return openHandStatus;
      if (openHandStatus.includes('No hand') || openHandStatus.includes('Open') || openHandStatus.includes('calibrate')) return 'Open your hand';
      if (openHandStatus.includes('Great job')) return 'Great job!';
      return 'Good — hold your hand open';
    }

    return '';
  }

  function handleStart()   { setSessionStarted(true); }

  function handleRestart() {
    setStepIndex(0);
    setSessionStarted(false);
    setTransitioning(false);
    setSessionDone(false);
    smileHoldStartRef.current  = null;
    transitionFiredRef.current = false;
    clearTimeout(transitionTimerRef.current);
    spokenRef.current = {
      welcome: false, smileIntro: false, smileHold: false,
      armIntro: false, armHold: false,
      handIntro: false, handHold: false,
      complete: false,
    };
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
              value={getStepStatus()}
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
