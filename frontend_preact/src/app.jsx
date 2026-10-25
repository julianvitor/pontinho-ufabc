import { useState } from 'preact/hooks';
import { LocationProvider, Router, Route } from 'preact-iso';
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

export function App() {
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  return (
    <LocationProvider>
      <div class="min-h-screen flex flex-col relative text-slate-100">
        <AmbientBackground />
        <ToastContainer />
        <Navbar
          onOpenTheme={() => setThemeModalOpen(true)}
          onOpenHelp={() => setHelpModalOpen(true)}
        />

        <div class="flex-1 flex flex-col relative z-10">
          <Router>
            <Route path="/" component={FeedPage} />
            <Route path="/index.html" component={FeedPage} />
            <Route path="/login" component={LoginPage} />
            <Route path="/login.html" component={LoginPage} />
            <Route path="/events" component={EventsPage} />
            <Route path="/events.html" component={EventsPage} />
            <Route path="/matches" component={MatchesPage} />
            <Route path="/matches.html" component={MatchesPage} />
            <Route path="/profile" component={ProfilePage} />
            <Route path="/profile.html" component={ProfilePage} />
            <Route path="/admin" component={AdminPage} />
            <Route path="/admin.html" component={AdminPage} />
            <Route path="/terms" component={TermsPage} />
            <Route path="/terms.html" component={TermsPage} />
            <Route default component={FeedPage} />
          </Router>
        </div>

        <BottomNav />

        <ThemeModal
          isOpen={themeModalOpen}
          onClose={() => setThemeModalOpen(false)}
        />
        <HelpModal
          isOpen={helpModalOpen}
          onClose={() => setHelpModalOpen(false)}
        />
      </div>
    </LocationProvider>
  );
}
