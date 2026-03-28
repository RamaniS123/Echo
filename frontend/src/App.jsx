import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ROUTES } from './config/appConfig';
import HomePage from './pages/HomePage';
import FacialExercisePage from './pages/FacialExercisePage';
import ArmMovement from './pages/ArmMovement';
import HandRecovery from './pages/HandRecovery';
import FullSession from './pages/FullSession';
import SummaryPage from './pages/SummaryPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path={ROUTES.HOME}            element={<HomePage />} />
          <Route path={ROUTES.FACIAL_EXERCISE} element={<FacialExercisePage />} />
          <Route path={ROUTES.ARM_MOVEMENT}    element={<ArmMovement />} />
          <Route path={ROUTES.HAND_RECOVERY}   element={<HandRecovery />} />
          <Route path={ROUTES.FULL_SESSION}    element={<FullSession />} />
          <Route path={ROUTES.SUMMARY}         element={<SummaryPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
