import styles from './MetricCard.module.css';

/**
 * MetricCard
 *
 * A compact metric display tile: label on top, large value beneath.
 * Used across Facial Exercise and Speech Practice mode panels.
 *
 * Props:
 *   label   — metric name (e.g. "Symmetry Score")
 *   value   — current value (string or number)
 *   accent  — if true, renders the value in accent colour (e.g. when session is active)
 *   wide    — if true, spans both columns in a 2-col metrics grid
 */
export default function MetricCard({ label, value, accent = false, wide = false }) {
  return (
    <div
      className={`${styles.card}${accent ? ` ${styles.accent}` : ''}${wide ? ` ${styles.wide}` : ''}`}
    >
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}
