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

    it('applies halloween theme and updates class list and localStorage', () => {
      applyTheme('halloween');
      expect(getStoredTheme()).toBe('halloween');
      expect(document.documentElement.classList.contains('theme-halloween')).toBe(true);
      expect(document.documentElement.classList.contains('theme-pride')).toBe(false);

      applyTheme('ufabc');
      expect(getStoredTheme()).toBe('ufabc');
      expect(document.documentElement.classList.contains('theme-halloween')).toBe(false);
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

  describe('Video to GIF Service', () => {
    it('detects video files by mime type and extension', async () => {
      const { isVideoFile } = await import('../services/videoToGif.js');
      expect(isVideoFile({ type: 'video/mp4', name: 'teste.mp4' })).toBe(true);
      expect(isVideoFile({ type: 'video/webm', name: 'clip.webm' })).toBe(true);
      expect(isVideoFile({ type: 'video/quicktime', name: 'gravação.mov' })).toBe(true);
      expect(isVideoFile({ type: '', name: 'video.mkv' })).toBe(true);
      expect(isVideoFile({ type: 'image/jpeg', name: 'foto.jpg' })).toBe(false);
      expect(isVideoFile({ type: 'image/gif', name: 'animado.gif' })).toBe(false);
      expect(isVideoFile(null)).toBe(false);
    });
  });

  describe('Image to WebP Service', () => {
    it('identifies webp and gif files correctly', async () => {
      const { isWebpOrGif } = await import('../services/imageToWebp.js');
      expect(isWebpOrGif({ type: 'image/webp', name: 'foto.webp' })).toBe(true);
      expect(isWebpOrGif({ type: 'image/gif', name: 'avatar.gif' })).toBe(true);
      expect(isWebpOrGif({ type: '', name: 'foto.WEBP' })).toBe(true);
      expect(isWebpOrGif({ type: 'image/jpeg', name: 'foto.jpg' })).toBe(false);
      expect(isWebpOrGif({ type: 'image/png', name: 'foto.png' })).toBe(false);
      expect(isWebpOrGif(null)).toBe(false);
    });

    it('returns webp or gif without converting', async () => {
      const { convertImageToWebp } = await import('../services/imageToWebp.js');
      const webpFile = new File(['fake-webp'], 'foto.webp', { type: 'image/webp' });
      const result = await convertImageToWebp(webpFile);
      expect(result).toBe(webpFile);
    });

    it('exports uploadMedia as universal upload service alias', async () => {
      const { uploadPhoto, uploadMedia } = await import('../services/api.js');
      expect(uploadMedia).toBe(uploadPhoto);
    });

    it('triggers onProgress during convertImageToWebp', async () => {
      const { convertImageToWebp } = await import('../services/imageToWebp.js');
      const progressUpdates = [];
      const fakeFile = new File(['fake-png'], 'teste.png', { type: 'image/png' });

      await convertImageToWebp(fakeFile, 0.92, (pct, stage) => {
        progressUpdates.push({ pct, stage });
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].pct).toBe(100);
    });

    it('triggers onProgress during uploadPhoto', async () => {
      const { uploadPhoto } = await import('../services/api.js');
      const progressCalls = [];
      const testFile = new File(['dummy-content'], 'foto.webp', { type: 'image/webp' });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: '/uploads/foto.webp' })
      });

      const res = await uploadPhoto(testFile, false, (pct, stage) => {
        progressCalls.push({ pct, stage });
      });

      expect(res.url).toBe('/uploads/foto.webp');
      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[progressCalls.length - 1].pct).toBe(100);
    });
  });
});
