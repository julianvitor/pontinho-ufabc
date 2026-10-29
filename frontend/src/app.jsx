import { useState } from 'preact/hooks';
import { LocationProvider, Router, Route, useLocation } from 'preact-iso';
import { AmbientBackground } from './components/AmbientBackground.jsx';
import { Navbar } from './components/Navbar.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { ToastContainer } from './components/ToastContainer.jsx';
import { ThemeModal } from './components/ThemeModal.jsx';
import { HelpModal } from './components/HelpModal.jsx';

import { FeedPage } from './pages/FeedPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { EventsPage } from './pages/EventsPage.jsx';
import { MatchesPage } from './pages/MatchesPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';
import { TermsPage } from './pages/TermsPage.jsx';

function AppContent({ onOpenTheme, onOpenHelp }) {
  const { path } = useLocation();
  const isAuth = path === '/login' || path === '/login.html';
  const isTerms = path === '/terms' || path === '/terms.html';

  return (
    <div class="min-h-screen flex flex-col relative text-slate-100">
      <AmbientBackground />
      <ToastContainer />
      {!isAuth && !isTerms && (
        <Navbar onOpenTheme={onOpenTheme} onOpenHelp={onOpenHelp} />
      )}

      <div class="flex-1 min-h-0 flex flex-col relative">
        <Router>
          <Route path="/" component={FeedPage} />
          <Route path="/index.html" component={FeedPage} />
          <Route path="/login" component={() => <LoginPage onOpenTheme={onOpenTheme} onOpenHelp={onOpenHelp} />} />
          <Route path="/login.html" component={() => <LoginPage onOpenTheme={onOpenTheme} onOpenHelp={onOpenHelp} />} />
          <Route path="/events" component={EventsPage} />
          <Route path="/events.html" component={EventsPage} />
          <Route path="/matches" component={MatchesPage} />
          <Route path="/matches.html" component={MatchesPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/profile.html" component={ProfilePage} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/admin.html" component={AdminPage} />
          <Route path="/terms" component={() => <TermsPage onOpenTheme={onOpenTheme} />} />
          <Route path="/terms.html" component={() => <TermsPage onOpenTheme={onOpenTheme} />} />
          <Route default component={FeedPage} />
        </Router>
      </div>

      {!isAuth && !isTerms && <BottomNav />}
    </div>
  );
}

export function App() {
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  return (
    <LocationProvider>
      <AppContent
        onOpenTheme={() => setThemeModalOpen(true)}
        onOpenHelp={() => setHelpModalOpen(true)}
      />
      <ThemeModal
        isOpen={themeModalOpen}
        onClose={() => setThemeModalOpen(false)}
      />
      <HelpModal
        isOpen={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />
    </LocationProvider>
  );
}
