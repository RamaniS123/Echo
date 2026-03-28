import { Link } from 'react-router-dom';
import { ROUTES } from '../config/appConfig';
import styles from './SummaryPage.module.css';

/**
 * SummaryPage
 *
 * Displays a session summary card after a practice session.
 * All stat values are placeholder ("—") until session state persistence is implemented.
 */
const SUMMARY_FIELDS = [
  { id: 'exercisesAttempted', label: 'Exercises Attempted' },
  { id: 'phrasesAttempted',   label: 'Phrases Attempted' },
  { id: 'duration',           label: 'Session Duration' },
];

export default function SummaryPage() {
  // Placeholder stats — will be populated from session state in a future iteration
  const stats = {
    exercisesAttempted: '—',
    phrasesAttempted: '—',
    duration: '—',
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to={ROUTES.HOME} className={styles.backLink}>← Home</Link>
        <h1 className={styles.title}>Session Summary</h1>
      </header>

      <div className={styles.card}>
        <h2 className={styles.cardHeading}>Session Complete</h2>

        <dl className={styles.statsList}>
          {SUMMARY_FIELDS.map(({ id, label }) => (
            <div key={id} className={styles.statRow}>
              <dt className={styles.statLabel}>{label}</dt>
              <dd className={styles.statValue}>{stats[id]}</dd>
            </div>
          ))}
        </dl>
      </div>

      <Link to={ROUTES.HOME} className={styles.homeButton}>
        Return Home
      </Link>
    </main>
  );
}
