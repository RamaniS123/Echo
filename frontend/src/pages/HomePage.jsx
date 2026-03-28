import { useNavigate } from 'react-router-dom';
import { APP_NAME, APP_TAGLINE, MODE_CARDS } from '../config/appConfig';
import styles from './HomePage.module.css';

/**
 * HomePage
 *
 * Entry point for Echo. Presents the two practice modes as large interactive buttons.
 * Mode definitions come from appConfig.MODE_CARDS — no routes or labels are hardcoded here.
 */
export default function HomePage() {
  const navigate = useNavigate();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.appName}>{APP_NAME}</h1>
        <p className={styles.tagline}>{APP_TAGLINE}</p>
      </header>

      <section className={styles.modes} aria-label="Practice modes">
        {MODE_CARDS.map((mode) => (
          <button
            key={mode.id}
            className={`${styles.modeButton} ${!mode.enabled ? styles.modeButtonDisabled : ''}`}
            disabled={!mode.enabled}
            onClick={() => navigate(mode.route)}
            aria-label={mode.label}
          >
            <span className={styles.modeLabel}>{mode.label}</span>
            <span className={styles.modeDescription}>{mode.description}</span>
          </button>
        ))}
      </section>
    </main>
  );
}
