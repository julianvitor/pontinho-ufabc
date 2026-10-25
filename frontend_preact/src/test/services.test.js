import { describe, it, expect, beforeEach } from 'vitest';
import { getCurrentUserId, setCurrentUserId, resolveMediaUrl, extractYouTubeId } from '../services/api.js';
import { getStoredTheme, applyTheme } from '../services/theme.js';
import { onBadgeCount } from '../services/notifications.js';

describe('Services Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('API & Auth Storage', () => {
    it('returns null when no user ID is in localStorage', () => {
      expect(getCurrentUserId()).toBeNull();
    });

    it('sets and gets user ID correctly', () => {
      setCurrentUserId(42, 'mock-token');
      expect(getCurrentUserId()).toBe(42);
      expect(localStorage.getItem('pontinho_session_token')).toBe('mock-token');
    });

    it('clears user ID and token on null', () => {
      setCurrentUserId(42, 'mock-token');
      setCurrentUserId(null);
      expect(getCurrentUserId()).toBeNull();
      expect(localStorage.getItem('pontinho_session_token')).toBeNull();
    });
  });

  describe('Media URL Resolution', () => {
    it('returns empty string on empty input', () => {
      expect(resolveMediaUrl('')).toBe('');
      expect(resolveMediaUrl(null)).toBe('');
    });

    it('preserves full http and https urls', () => {
      const url = 'https://images.unsplash.com/photo-12345';
      expect(resolveMediaUrl(url)).toBe(url);
    });

    it('preserves data: and blob: urls', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo';
      expect(resolveMediaUrl(dataUrl)).toBe(dataUrl);
    });

    it('appends session token to private media url if present', () => {
      setCurrentUserId(1, 'my_secret_token');
      const resolved = resolveMediaUrl('/api/media/private/photo1.webp');
      expect(resolved).toContain('token=my_secret_token');
    });
  });

  describe('YouTube ID Extraction', () => {
    it('extracts ID from standard watch URL', () => {
      expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from youtu.be short URL', () => {
      expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('accepts raw 11-char ID', () => {
      expect(extractYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('returns null for empty or invalid query', () => {
      expect(extractYouTubeId('')).toBeNull();
      expect(extractYouTubeId('invalid-query-not-youtube')).toBeNull();
    });
  });

  describe('Theme Management', () => {
    it('defaults to ufabc theme', () => {
      expect(getStoredTheme()).toBe('ufabc');
    });

    it('applies pride theme and updates class list and localStorage', () => {
      applyTheme('pride');
      expect(getStoredTheme()).toBe('pride');
      expect(document.documentElement.classList.contains('theme-pride')).toBe(true);

      applyTheme('ufabc');
      expect(getStoredTheme()).toBe('ufabc');
      expect(document.documentElement.classList.contains('theme-pride')).toBe(false);
    });
  });

  describe('Notifications Service', () => {
    it('notifies subscribers with current count', () => {
      let countVal = -1;
      const unsub = onBadgeCount((c) => {
        countVal = c;
      });
      expect(countVal).toBe(0);
      unsub();
    });
  });
});
