import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('SessionPanel source', () => {
  it('does not keep a manual save action for the active workout', () => {
    const source = readFileSync(resolve(__dirname, 'App.tsx'), 'utf8');

    expect(source).not.toContain('Тренировка сохранена');
    expect(source).not.toContain('onSave={() => saveSession()}');
  });
});
