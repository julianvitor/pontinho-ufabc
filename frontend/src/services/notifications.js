// Polling e observação reativa de badges de mensagens e matches não lidos
import { apiFetch, getCurrentUserId } from './api.js';

let badgeListeners = new Set();
let pollingInterval = null;
let currentBadgeCount = 0;

export function onBadgeCount(listener) {
  badgeListeners.add(listener);
  listener(currentBadgeCount);
  return () => badgeListeners.delete(listener);
}

export async function fetchUnreadCount() {
  const userId = getCurrentUserId();
  if (!userId) {
    currentBadgeCount = 0;
    badgeListeners.forEach(fn => fn(0));
    return 0;
  }

  try {
    const data = await apiFetch('/api/matches/unread-count');
    const count = (data && data.total) || 0;
    currentBadgeCount = count;
    badgeListeners.forEach(fn => fn(count));
    return count;
  } catch (_) {
    return currentBadgeCount;
  }
}

export function startBadgePolling(intervalMs = 12000) {
  fetchUnreadCount();
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(fetchUnreadCount, intervalMs);
}

export function stopBadgePolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}
