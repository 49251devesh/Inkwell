import React from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { InkwellProvider } from './store/inkwellStore';
import { ToastProvider } from './hooks/useToast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { StudioShell } from './components/layout/StudioShell';
import { LibraryPage } from './pages/LibraryPage';
import { DeskPage } from './pages/DeskPage';
import { ManuscriptsPage } from './pages/ManuscriptsPage';
import { CharacterStudioPage } from './pages/CharacterStudioPage';
import { WorldBuilderPage } from './pages/WorldBuilderPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { PlaceholderStudioPage } from './pages/PlaceholderStudioPage';
import { ReadingRoomPage } from './pages/ReadingRoomPage';

const PageTurnFrame: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{
        duration: 0.28,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="w-full min-h-full"
    >
      {children}
    </motion.div>
  );
};

const AnimatedStudioRoutes: React.FC = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageTurnFrame>
              <LibraryPage />
            </PageTurnFrame>
          }
        />
        <Route
          path="/desk"
          element={
            <PageTurnFrame>
              <DeskPage />
            </PageTurnFrame>
          }
        />
        <Route
          path="/desk/:projectId"
          element={
            <PageTurnFrame>
              <DeskPage />
            </PageTurnFrame>
          }
        />
        <Route
          path="/projects"
          element={
            <PageTurnFrame>
              <ManuscriptsPage />
            </PageTurnFrame>
          }
        />
        <Route
          path="/characters"
          element={
            <PageTurnFrame>
              <CharacterStudioPage />
            </PageTurnFrame>
          }
        />
        <Route
          path="/world"
          element={
            <PageTurnFrame>
              <WorldBuilderPage />
            </PageTurnFrame>
          }
        />
        <Route
          path="/analytics"
          element={
            <PageTurnFrame>
              <AnalyticsPage />
            </PageTurnFrame>
          }
        />
        <Route
          path="/reading-room"
          element={
            <PageTurnFrame>
              <ReadingRoomPage />
            </PageTurnFrame>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <InkwellProvider>
            <ToastProvider>
              <StudioShell>
                <AnimatedStudioRoutes />
              </StudioShell>
            </ToastProvider>
          </InkwellProvider>
        </BrowserRouter>
      </MotionConfig>
    </ErrorBoundary>
  );
}
