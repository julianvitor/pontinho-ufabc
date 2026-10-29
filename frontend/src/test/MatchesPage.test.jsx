import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { MatchesPage } from '../pages/MatchesPage.jsx';
import { setCurrentUserId } from '../services/api.js';

describe('MatchesPage Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders conversations list with partner name, campus badge and last message (real backend format)', async () => {
    setCurrentUserId(2, 'mock_token');

    const mockMatchesBackend = [
      {
        match_id: 86,
        match_date: '2026-10-24 05:29:59',
        partner: {
          id: 5,
          name: 'Gabriel Santos',
          age: 23,
          campus: 'Santo André',
          course: 'BC&T - Bacharelado em Ciência e Tecnologia',
          specific_course: 'Ciência da Computação',
          photos: ['https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800']
        },
        last_message: {
          text: 'Toco sim! Na caixa! Bora tomar um drink?',
          sender_id: 5,
          read_at: null,
          created_at: '2026-10-27 20:39:28'
        },
        unread_count: 2,
        is_new: false
      }
    ];

    const mockMessagesBackend = {
      match_id: 86,
      partner: mockMatchesBackend[0].partner,
      current_user_id: 2,
      messages: [
        {
          id: 268,
          match_id: 86,
          sender_id: 5,
          text: 'Toco sim! Na caixa! Bora tomar um drink?',
          read_at: null,
          created_at: '2026-10-27 20:39:28'
        }
      ]
    };

    const mockPrivateStatusBackend = {
      partner_id: 5,
      partner_name: 'Gabriel Santos',
      partner_has_private: true,
      partner_private_count: 2,
      my_request_status: 'none',
      their_request_status: 'none',
      unlocked_content: null
    };

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/matches/86/messages')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockMessagesBackend
        });
      }
      if (url.includes('/api/matches/86/private-status')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockPrivateStatusBackend
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockMatchesBackend
      });
    });

    render(<MatchesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Gabriel Santos').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Toco sim! Na caixa! Bora tomar um drink?').length).toBeGreaterThan(0);
      expect(screen.getByText('2')).toBeTruthy();
      expect(screen.getAllByText('SA').length).toBeGreaterThan(0);
      expect(screen.getByText('Solicitar Acesso 🔒')).toBeTruthy();
    });
  });

  it('renders unlocked secret album and private bio correctly', async () => {
    setCurrentUserId(2, 'mock_token');

    const mockMatches = [
      {
        match_id: 86,
        partner: {
          id: 5,
          name: 'Gabriel Santos',
          photos: []
        },
        last_message: { text: 'Oi!' }
      }
    ];

    const mockPrivateApproved = {
      partner_id: 5,
      partner_name: 'Gabriel Santos',
      partner_has_private: true,
      partner_private_count: 1,
      my_request_status: 'approved',
      their_request_status: 'none',
      unlocked_content: {
        private_photos: ['https://images.unsplash.com/secret1'],
        private_bio: 'Minha bio super secreta revelada!'
      }
    };

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/matches/86/private-status')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockPrivateApproved
        });
      }
      if (url.includes('/api/matches/86/messages')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ match_id: 86, messages: [] })
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
      expect(screen.getByText('Ver Fotos & Bio')).toBeTruthy();
    });

    // Clica no botão para abrir modal
    fireEvent.click(screen.getByText('Ver Fotos & Bio'));

    await waitFor(() => {
      expect(screen.getByText('Minha bio super secreta revelada!')).toBeTruthy();
      expect(screen.getByText('#1')).toBeTruthy();
    });
  });
});
