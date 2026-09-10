import { describe, expect, it, vi } from 'vitest';

import apiClient from '../src/config/api.config';

const getDeduplicationInterceptor = () => apiClient.interceptors.request.handlers[0].fulfilled;

const createResponse = (config, data = { ok: true }) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config
});

describe('API client GET adapter', () => {
  it('resolves an Axios adapter list before invoking it', async () => {
    const rawAdapter = vi.fn(async (config) => createResponse(config));
    const config = {
      method: 'get',
      url: '/courses',
      params: { page: 1 },
      adapter: [rawAdapter]
    };

    const wrappedConfig = getDeduplicationInterceptor()(config);
    const response = await wrappedConfig.adapter(wrappedConfig);

    expect(response.status).toBe(200);
    expect(rawAdapter).toHaveBeenCalledTimes(1);
  });

  it('deduplicates identical GETs without merging requests with different params', async () => {
    const rawAdapter = vi.fn(async (config) => createResponse(config, config.params));
    const wrap = getDeduplicationInterceptor();
    const first = wrap({ method: 'get', url: '/courses', params: { page: 1 }, adapter: [rawAdapter] });
    const duplicate = wrap({ method: 'get', url: '/courses', params: { page: 1 }, adapter: [rawAdapter] });
    const different = wrap({ method: 'get', url: '/courses', params: { page: 2 }, adapter: [rawAdapter] });

    const [firstResponse, duplicateResponse, differentResponse] = await Promise.all([
      first.adapter(first),
      duplicate.adapter(duplicate),
      different.adapter(different)
    ]);

    expect(rawAdapter).toHaveBeenCalledTimes(2);
    expect(firstResponse.data).toEqual({ page: 1 });
    expect(duplicateResponse).toBe(firstResponse);
    expect(differentResponse.data).toEqual({ page: 2 });
  });
});
