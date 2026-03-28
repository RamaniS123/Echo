import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../config/appConfig';
import { SPEECH_CATEGORIES } from '../config/speechCategories';
import CategoryCard from '../components/CategoryCard';
import CommonPhrases from './CommonPhrases';
import styles from './SpeechPracticePage.module.css';

/**
 * SpeechPracticePage
 *
 * Displays the speech practice category grid.
 * When an enabled category is selected, swaps to that category's practice flow.
 * Currently only 'commonPhrases' has an active flow.
 */
export default function SpeechPracticePage() {
  const [activeCategoryId, setActiveCategoryId] = useState(null);

  if (activeCategoryId === 'commonPhrases') {
    return <CommonPhrases onBack={() => setActiveCategoryId(null)} />;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to={ROUTES.HOME} className={styles.backLink}>← Home</Link>
        <h1 className={styles.title}>Speech Practice</h1>
      </header>

      <section className={styles.categories} aria-label="Speech practice categories">
        {SPEECH_CATEGORIES.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            onSelect={setActiveCategoryId}
          />
        ))}
      </section>
    </main>
  );
}
