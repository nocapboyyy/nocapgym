import { describe, expect, it } from 'vitest';
import { buildUserExportPayload } from '../src/domain/backup.js';

describe('backup', () => {
  it('exports user-owned templates and sessions without global exercises', () => {
    const payload = buildUserExportPayload({
      user: { telegramId: '42', firstName: 'Ivan', username: 'ivan' },
      templates: [{ id: 'template-1', name: 'Грудь', exercises: [] }],
      sessions: [{ id: 'session-1', status: 'completed', exercises: [] }]
    });

    expect(payload.user.telegramId).toBe('42');
    expect(payload.templates).toHaveLength(1);
    expect(payload.sessions).toHaveLength(1);
    expect(payload).not.toHaveProperty('exercises');
  });
});

