export type UserExportPayloadInput = {
  user: {
    telegramId: string;
    firstName: string | null;
    username: string | null;
  };
  templates: unknown[];
  sessions: unknown[];
};

export function buildUserExportPayload(input: UserExportPayloadInput) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    user: input.user,
    templates: input.templates,
    sessions: input.sessions
  };
}

