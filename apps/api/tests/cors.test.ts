import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.js';

describe('CORS', () => {
  it('allows browser preflight requests for mutation methods used by the miniapp', async () => {
    const app = await buildServer({
      config: {
        botToken: 'dev-token',
        adminTelegramIds: '',
        port: 4000,
        allowDevAuth: true
      }
    });

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/sessions/session-id',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'PATCH',
        'access-control-request-headers': 'content-type,x-dev-telegram-id'
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-methods']).toContain('PATCH');
    expect(response.headers['access-control-allow-methods']).toContain('DELETE');

    await app.close();
  });
});

