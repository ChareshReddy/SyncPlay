/**
 * SyncPlay - Server Configuration & Connection Health Utility
 * Handles protocol normalization (local HTTP vs remote HTTPS) and health checks with cold-start retry.
 */

export const DEFAULT_RENDER_SERVER_URL = 'https://syncplay-7qwj.onrender.com';
export const DEFAULT_LOCAL_SERVER_URL = 'http://192.168.1.50:4000';

/**
 * Normalizes user-entered or stored server URL:
 * 1. Trims whitespace and trailing slashes.
 * 2. If protocol (http:// or https://) is already present, preserves it.
 * 3. If protocol is missing:
 *    - Uses http:// for local LAN IPs (192.168., 10., 172.16-31., 127.0.0.1, localhost, or port :4000/:3000).
 *    - Uses https:// for remote domains (e.g. syncplay-7qwj.onrender.com).
 */
export function normalizeServerUrl(rawUrl?: string | null): string {
  let clean = (rawUrl || '').trim();
  if (!clean) {
    return DEFAULT_RENDER_SERVER_URL;
  }

  // Remove trailing slashes
  clean = clean.replace(/\/+$/, '');

  // If protocol is already specified, preserve it
  if (/^https?:\/\//i.test(clean)) {
    return clean;
  }

  // Detect local LAN addresses
  const isLocal =
    clean.startsWith('192.168.') ||
    clean.startsWith('10.') ||
    clean.startsWith('172.16.') ||
    clean.startsWith('172.17.') ||
    clean.startsWith('172.18.') ||
    clean.startsWith('172.19.') ||
    clean.startsWith('172.2') ||
    clean.startsWith('172.3') ||
    clean.startsWith('127.0.0.1') ||
    clean.startsWith('localhost') ||
    clean.includes(':4000') ||
    clean.includes(':3000') ||
    clean.includes(':8080');

  return isLocal ? `http://${clean}` : `https://${clean}`;
}

export interface HealthCheckResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
  serverTimestamp?: number;
  roomsCount?: number;
}

/**
 * Tests server reachability via GET {serverUrl}/health.
 * Handles free-tier cold starts: if initial attempt fails/times out,
 * notifies caller and retries once with a 60-second window.
 */
export async function checkServerHealth(
  serverUrl: string,
  onColdStartNotice?: (notice: string) => void
): Promise<HealthCheckResult> {
  const normalized = normalizeServerUrl(serverUrl);
  const healthEndpoint = `${normalized}/health`;

  // Helper to fetch with timeout
  const fetchWithTimeout = async (timeoutMs: number): Promise<{ res: Response; elapsed: number }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();
    try {
      const res = await fetch(healthEndpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      return { res, elapsed: Date.now() - start };
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  // 1. Initial Fast Attempt (5s timeout)
  try {
    const { res, elapsed } = await fetchWithTimeout(5000);
    if (res.ok) {
      const data = await res.json();
      return {
        ok: true,
        message: `Connected (${elapsed}ms)`,
        latencyMs: elapsed,
        serverTimestamp: data.timestamp,
        roomsCount: data.roomsCount,
      };
    }
  } catch (initialErr) {
    // Initial request timed out or network error (likely sleeping free-tier container)
  }

  // 2. Cold-Start Retry Attempt (up to 60s)
  if (onColdStartNotice) {
    onColdStartNotice('Connecting... this may take up to 60 seconds if the server was asleep');
  }

  try {
    const { res, elapsed } = await fetchWithTimeout(60000);
    if (res.ok) {
      const data = await res.json();
      return {
        ok: true,
        message: `Server is awake! Connected (${elapsed}ms)`,
        latencyMs: elapsed,
        serverTimestamp: data.timestamp,
        roomsCount: data.roomsCount,
      };
    } else {
      return {
        ok: false,
        message: `Server returned HTTP ${res.status}`,
      };
    }
  } catch (retryErr: any) {
    return {
      ok: false,
      message: `Could not reach ${normalized}. Check your internet connection or URL.`,
    };
  }
}
