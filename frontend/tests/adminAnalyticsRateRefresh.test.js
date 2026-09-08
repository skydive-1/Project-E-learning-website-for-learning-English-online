import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../src/config/api.config';
import {
  getGeminiRateLimitCaps,
  getGeminiRateLimitStatus
} from '../src/modules/admin/services/adminAnalytics.service';

vi.mock('../src/config/api.config', () => ({
  default: {
    get: vi.fn()
  }
}));

describe('Gemini rate-limit fresh requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a cache buster and no-cache headers for manual refreshes', async () => {
    apiClient.get
      .mockResolvedValueOnce({ data: { success: true, data: { models: [] } } })
      .mockResolvedValueOnce({ data: { success: true, data: { models: [] } } });

    await getGeminiRateLimitStatus({ fresh: true });
    await getGeminiRateLimitCaps({ fresh: true });

    for (const [, config] of apiClient.get.mock.calls) {
      expect(config.params._refresh).toEqual(expect.any(Number));
      expect(config.headers).toMatchObject({
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      });
    }
  });
});
