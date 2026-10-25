import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import { MatchesPage } from '../pages/MatchesPage.jsx';
import { setCurrentUserId } from '../services/api.js';

describe('MatchesPage Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders conversations list with partner name and last message', async () => {
    setCurrentUserId(1, 'mock_token');

    const mockMatches = [
      {
        id: 10,
        name: 'Zendaya',
        age: 23,
        campus: 'Santo André',
        specific_course: 'Biotecnologia',
        photos: ['https://images.unsplash.com/photo-zendaya'],
        last_message: 'Oi! Vamos tomar um açaí?',
        unread_count: 2
      }
    ];

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/matches/10/messages')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [{ id: 1, sender_id: 2, text: 'Oi! Vamos tomar um açaí?' }]
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockMatches
      });
    });

    render(<MatchesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Zendaya').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Oi! Vamos tomar um açaí?').length).toBeGreaterThan(0);
      expect(screen.getByText('2')).toBeTruthy();
    });
  });
});
