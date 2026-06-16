import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function cssRule(selector: string) {
  const source = readFileSync(resolve(__dirname, 'styles.css'), 'utf8');
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...source.matchAll(new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`, 'g'))];
  return matches.at(-1)?.groups?.body ?? '';
}

describe('finish-panel layout', () => {
  it('keeps workout finish controls in normal document flow', () => {
    const rule = cssRule('.finish-panel');

    expect(rule).not.toContain('position: sticky');
    expect(rule).not.toContain('bottom:');
  });

  it('hides only the bottom tabbar while editing fields', () => {
    const source = readFileSync(resolve(__dirname, 'styles.css'), 'utf8');

    expect(source).toContain('.app-shell.bottom-controls-hidden .tabbar');
    expect(source).not.toContain('.app-shell.bottom-controls-hidden .finish-panel');
  });
});
