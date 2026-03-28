import styles from './WebcamPanel.module.css';

/**
 * WebcamPanel
 *
 * Placeholder for the live webcam feed and optional landmark overlay.
 * MediaPipe integration will replace the placeholder content with a
 * <video> or <canvas> element.
 *
 * Props: none for now (ref and stream props will be added at integration time)
 */
export default function WebcamPanel() {
  return (
    <div className={styles.panel} aria-label="Webcam feed area" role="img">
      <div className={styles.placeholder} aria-hidden="true">
        <svg
          className={styles.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 10l4.553-2.07A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
        </svg>
        <span>Camera feed will appear here</span>
      </div>
    </div>
  );
}
