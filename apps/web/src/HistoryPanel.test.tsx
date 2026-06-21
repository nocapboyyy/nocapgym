import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HistoryPanel } from './App';

describe('HistoryPanel', () => {
  it('renders calendar, progress, and history without backup controls', () => {
    const markup = renderToStaticMarkup(
      <HistoryPanel
        history={[]}
        progress={[]}
        selectedExerciseId=""
        onSelectExercise={() => undefined}
        onDeleteSession={() => undefined}
      />
    );

    expect(markup).toContain('Календарь тренировок за');
    expect(markup).toContain('<h2>Прогресс</h2>');
    expect(markup).toContain('<h2>История</h2>');
    expect(markup).not.toContain('<h2>Backup</h2>');
    expect(markup).not.toContain('Экспорт JSON');
    expect(markup).not.toContain('Импорт JSON');
    expect(markup).not.toContain('type="file"');
  });
});
