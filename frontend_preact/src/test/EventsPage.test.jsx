import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import { EventsPage } from '../pages/EventsPage.jsx';

describe('EventsPage Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders party list with dates, titles and locations', async () => {
    const mockEvents = [
      {
        id: 1,
        title: 'Cervejada Geral UFABC',
        description: 'Open bar com a Bateria Universitária!',
        event_date: '2026-11-14 22:00',
        location: 'Espaço Modular - Santo André',
        attendees_count: 42,
        is_attending: false
      }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockEvents
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Cervejada Geral UFABC')).toBeTruthy();
      expect(screen.getByText(/Espaço Modular/i)).toBeTruthy();
      expect(screen.getByText('14')).toBeTruthy();
      expect(screen.getByText('NOV')).toBeTruthy();
      expect(screen.getByText(/42 confirmados/i)).toBeTruthy();
      expect(screen.getByText(/Vou Colar!/i)).toBeTruthy();
      expect(screen.getByText(/Ver Quem Vai/i)).toBeTruthy();
    });
  });
});
