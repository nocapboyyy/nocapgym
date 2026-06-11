import { describe, expect, it } from 'vitest';
import { buildRequestHeaders } from './api';

describe('buildRequestHeaders', () => {
  it('does not send json content-type for requests without a body', () => {
    const headers = buildRequestHeaders({ 'x-telegram-init-data': 'init-data' }, undefined, false);

    expect(headers).not.toHaveProperty('content-type');
    expect(headers).toHaveProperty('x-telegram-init-data', 'init-data');
  });

  it('sends json content-type for requests with a body', () => {
    const headers = buildRequestHeaders({ 'x-telegram-init-data': 'init-data' }, undefined, true);

    expect(headers).toHaveProperty('content-type', 'application/json');
  });
});

