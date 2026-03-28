import styles from './MovementBar.module.css';

/**
 * MovementBar
 *
 * Displays a labelled vertical bar representing movement magnitude for one side
 * of the face (left or right). Value is 0–100.
 *
 * Props:
 *   label  — "Left" | "Right" (or any side label)
 *   value  — number 0–100 (default: 0)
 */
export default function MovementBar({ label, value = 0 }) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={styles.wrapper} aria-label={`${label} side movement: ${clamped}%`}>
      <span className={styles.label}>{label}</span>
      <div className={styles.track} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={styles.fill}
          style={{ height: `${clamped}%` }}
        />
      </div>
      <span className={styles.value}>{clamped}</span>
    </div>
  );
}
