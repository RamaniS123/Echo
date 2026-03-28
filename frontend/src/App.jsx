import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ROUTES } from './config/appConfig';
import HomePage from './pages/HomePage';
import FacialExercisePage from './pages/FacialExercisePage';
import SpeechPracticePage from './pages/SpeechPracticePage';
import SummaryPage from './pages/SummaryPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path={ROUTES.HOME}            element={<HomePage />} />
          <Route path={ROUTES.FACIAL_EXERCISE} element={<FacialExercisePage />} />
          <Route path={ROUTES.SPEECH_PRACTICE} element={<SpeechPracticePage />} />
          <Route path={ROUTES.SUMMARY}         element={<SummaryPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
