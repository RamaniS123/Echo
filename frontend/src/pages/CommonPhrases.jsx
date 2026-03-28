import { useState } from 'react';
import { getPhrasesForCategory } from '../config/speechCategories';
import WebcamPanel from '../components/WebcamPanel';
import MetricCard from '../components/MetricCard';
import styles from './CommonPhrases.module.css';

/**
 * Status values for the phrase attempt cycle.
 * Defined here so they can be referenced consistently when
 * real microphone logic is wired in via a custom hook.
 */
const STATUS = {
  IDLE:      'idle',
  LISTENING: 'listening',
  STOPPED:   'stopped',
};

const STATUS_LABEL = {
  [STATUS.IDLE]:      'Press start to begin',
  [STATUS.LISTENING]: 'Listening\u2026',
  [STATUS.STOPPED]:   'Stopped',
};

const phrases = getPhrasesForCategory('commonPhrases');

/**
 * CommonPhrases
 *
 * Phrase-by-phrase speech practice flow.
 * Phrases come from config (speechCategories.js) — nothing is hardcoded here.
 * No microphone or API calls yet.
 *
 * Props:
 *   onBack — called when the user presses the back button
 */
export default function CommonPhrases({ onBack }) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [status, setStatus] = useState(STATUS.IDLE);

  const currentPhrase = phrases[phraseIndex];
  const isListening = status === STATUS.LISTENING;

  // Placeholder speech metrics — driven by useSpeechAttempt hook in a future iteration
  const speechMetrics = [
    { id: 'speechDetected', label: 'Speech Detected', value: 'No' },
    { id: 'volume',         label: 'Volume',          value: '--' },
    { id: 'duration',       label: 'Duration',        value: '--' },
    { id: 'mouthMovement',  label: 'Mouth Movement',  value: '--' },
  ];

  function handleStart() {
    setStatus(STATUS.LISTENING);
  }

  function handleStop() {
    setStatus(STATUS.STOPPED);
  }

  function handleNextPhrase() {
    setPhraseIndex((i) => (i + 1) % phrases.length);
    setStatus(STATUS.IDLE);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={onBack}
          aria-label="Back to Speech Practice"
        >
          ← Home
        </button>
        <h1 className={styles.title}>Speech Practice</h1>
      </header>

      <div className={styles.layout}>
        {/* Left column: webcam feed */}
        <section className={styles.webcamColumn} aria-label="Webcam panel">
          <WebcamPanel isTracking={isListening} />
        </section>

        {/* Right column: phrase card, metrics, controls */}
        <section className={styles.controlColumn} aria-label="Speech practice controls">
          {/* Phrase display card */}
          <div
            className={styles.phraseCard}
            aria-live="polite"
            aria-label={`Say: ${currentPhrase.text}`}
          >
            <span className={styles.sayLabel}>Say:</span>
            <p className={styles.phraseText}>{currentPhrase.text}</p>
          </div>

          {/* Speech metrics grid */}
          <div className={styles.metricsGrid} aria-label="Speech metrics">
            {speechMetrics.map((m) => (
              <MetricCard key={m.id} label={m.label} value={m.value} />
            ))}
            <MetricCard
              label="Status"
              value={STATUS_LABEL[status]}
              accent={isListening}
              wide
            />
          </div>

          {/* Controls */}
          <div className={styles.controls}>
            <button
              type="button"
              className={isListening ? styles.stopButton : styles.primaryButton}
              onClick={isListening ? handleStop : handleStart}
            >
              {isListening ? 'Stop' : 'Start'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleNextPhrase}
              disabled={isListening}
            >
              Next Phrase
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
