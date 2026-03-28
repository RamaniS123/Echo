import styles from './SymmetryScore.module.css';

/**
 * SymmetryScore
 *
 * Displays the current facial symmetry score prominently.
 * A score of "--" indicates no measurement is available yet.
 *
 * Props:
 *   score — number 0–100, or "--" when no data is available (default: "--")
 */
export default function SymmetryScore({ score = '--' }) {
  return (
    <div className={styles.wrapper} aria-label={`Symmetry score: ${score}`}>
      <span className={styles.scoreLabel}>Symmetry Score</span>
      <span className={styles.score} aria-live="polite">
        {score}
      </span>
    </div>
  );
}
