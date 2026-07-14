import { describe, expect, it } from 'vitest';
import { ApiError, buildRequestHeaders, getUserFacingApiError, readApiError } from './api';

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

describe('readApiError', () => {
  it('preserves the status and stable backend error code', async () => {
    const error = await readApiError(
      new Response(
        JSON.stringify({
          code: 'TELEGRAM_AUTH_EXPIRED',
          message: 'Сессия Telegram устарела. Закройте и снова откройте приложение'
        }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      )
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ statusCode: 401, code: 'TELEGRAM_AUTH_EXPIRED' });
  });
});

describe('getUserFacingApiError', () => {
  it('turns backend validation failures into a clear Russian message', () => {
    expect(getUserFacingApiError(new ApiError('Некорректные данные', 400, 'VALIDATION_ERROR'), 'Ошибка')).toBe(
      'Проверьте заполнение полей: некоторые значения недопустимы.'
    );
  });
});
