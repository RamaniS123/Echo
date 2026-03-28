import styles from './CategoryCard.module.css';

/**
 * CategoryCard
 *
 * Renders a speech category tile.
 * Enabled categories are fully interactive.
 * Disabled categories are shown with a "Coming Soon" badge and are not clickable.
 *
 * Props:
 *   category  — object from SPEECH_CATEGORIES in speechCategories.js
 *   onSelect  — called with category.id when an enabled card is activated
 */
export default function CategoryCard({ category, onSelect }) {
  const { id, label, description, enabled } = category;

  function handleClick() {
    if (enabled) onSelect(id);
  }

  function handleKeyDown(e) {
    if (enabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelect(id);
    }
  }

  return (
    <div
      className={`${styles.card} ${!enabled ? styles.disabled : ''}`}
      role="button"
      tabIndex={enabled ? 0 : -1}
      aria-disabled={!enabled}
      aria-label={enabled ? label : `${label} — coming soon`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {!enabled && <span className={styles.badge}>Coming Soon</span>}
      </div>
      <p className={styles.description}>{description}</p>
    </div>
  );
}
