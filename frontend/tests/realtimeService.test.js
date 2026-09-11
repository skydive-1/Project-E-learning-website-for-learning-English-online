import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../src/config/api.config';
import { RealtimeService } from '../src/services/realtime.service';

vi.mock('../src/config/api.config', () => ({
  default: {
    defaults: { baseURL: 'http://localhost:5000/api' },
    post: vi.fn()
  }
}));

class MockEventSource {
  static CLOSED = 2;

  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.listeners = new Map();
    MockEventSource.instances.push(this);
  }

  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }
}

describe('Instructor realtime service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('exchanges the session header for a short-lived SSE ticket', async () => {
    apiClient.post.mockResolvedValue({
      data: { data: { ticket: 'short-lived-ticket' } }
    });
    const service = new RealtimeService();
    const onConnected = vi.fn();
    service.subscribe('connected', onConnected);

    await service.connect(26);

    expect(apiClient.post).toHaveBeenCalledWith('/instructor/realtime/ticket');
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe(
      'http://localhost:5000/api/instructor/realtime/stream?ticket=short-lived-ticket'
    );
    expect(MockEventSource.instances[0].url).not.toContain('?token=');

    MockEventSource.instances[0].onopen();
    expect(onConnected).toHaveBeenCalledOnce();
    expect(service.getStatus()).toBe(true);
    service.close();
  });

  it('stops retrying when ticket creation reports an authentication failure', async () => {
    const authError = {
      response: { status: 401, data: { code: 'TOKEN_EXPIRED' } }
    };
    apiClient.post.mockRejectedValue(authError);
    const service = new RealtimeService();
    const onAuthError = vi.fn();
    service.subscribe('auth_error', onAuthError);

    await expect(service.connect(26)).rejects.toBe(authError);

    expect(onAuthError).toHaveBeenCalledWith(authError);
    expect(service.shouldReconnect).toBe(false);
    expect(service.reconnectTimer).toBeNull();
    expect(service.reconnectAttempts).toBe(0);
    service.close();
  });

  it('cancels a pending reconnect when the dashboard unmounts', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    apiClient.post.mockResolvedValue({
      data: { data: { ticket: 'short-lived-ticket' } }
    });
    const service = new RealtimeService();

    await service.connect(26);
    MockEventSource.instances[0].onerror(new Event('error'));
    expect(service.reconnectTimer).not.toBeNull();

    service.close();
    await vi.advanceTimersByTimeAsync(1000);

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(service.reconnectTimer).toBeNull();
  });

  it('ignores a stale ticket request after a newer connection starts', async () => {
    let rejectFirstRequest;
    apiClient.post
      .mockImplementationOnce(() => new Promise((resolve, reject) => {
        rejectFirstRequest = reject;
      }))
      .mockResolvedValueOnce({
        data: { data: { ticket: 'new-ticket' } }
      });
    const service = new RealtimeService();
    const firstConnection = service.connect(26);

    await service.connect(27);
    rejectFirstRequest({ response: { status: 401, data: { code: 'TOKEN_EXPIRED' } } });
    await expect(firstConnection).resolves.toBe(false);

    expect(service.shouldReconnect).toBe(true);
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain('ticket=new-ticket');
    service.close();
  });
});
