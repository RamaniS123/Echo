import { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import styles from './WebcamPanel.module.css';

const VIDEO_CONSTRAINTS = {
  facingMode: 'user',
  width: { ideal: 1280 },
  height: { ideal: 960 },
};

/**
 * WebcamPanel
 *
 * Displays the live webcam feed.
 * Handles requesting access, loading while the stream starts, and
 * permission-denied / hardware-error states gracefully.
 *
 * The webcam ref is forwarded so future MediaPipe integration can
 * read frames directly: pass `webcamRef` as a prop to receive it.
 *
 * Props:
 *   webcamRef — optional React ref forwarded to the underlying <Webcam> element
 */
export default function WebcamPanel({ webcamRef, isTracking = false }) {
  const [camState, setCamState] = useState('loading'); // 'loading' | 'active' | 'error'
  const internalRef = useRef(null);
  const resolvedRef = webcamRef ?? internalRef;

  return (
    <div
      className={styles.panel}
      aria-label={
        camState === 'active'
          ? 'Live webcam feed — tracking active'
          : camState === 'error'
          ? 'Webcam unavailable'
          : 'Requesting camera access'
      }
      role="img"
    >
      {/* Live feed — always mounted so the stream starts immediately */}
      <Webcam
        ref={resolvedRef}
        audio={false}
        videoConstraints={VIDEO_CONSTRAINTS}
        mirrored
        className={styles.video}
        style={{ opacity: camState === 'active' ? 1 : 0 }}
        onUserMedia={() => setCamState('active')}
        onUserMediaError={() => setCamState('error')}
        screenshotFormat="image/jpeg"
      />

      {/* Overlay shown while waiting for stream */}
      {camState === 'loading' && (
        <div className={styles.overlay}>
          <span className={styles.spinnerRing} aria-hidden="true" />
          <span>Requesting camera access…</span>
        </div>
      )}

      {/* Overlay shown on permission denied or hardware error */}
      {camState === 'error' && (
        <div className={`${styles.overlay} ${styles.overlayError}`}>
          <svg
            className={styles.errorIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Camera access denied.</span>
          <span className={styles.errorSub}>Please enable your webcam and reload.</span>
        </div>
      )}

      {/* Tracking badge — shown only when parent signals active tracking */}
      {camState === 'active' && isTracking && (
        <div className={styles.trackingBadge} aria-hidden="true">
          <span className={styles.trackingDot} />
          Tracking
        </div>
      )}
    </div>
  );
}
