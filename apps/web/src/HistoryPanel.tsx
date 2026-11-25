import { useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { ReadStatus, useScreenData } from './screen-data';
import { MonthCalendar } from './MonthCalendar';
import type { HistoryCard, HistoryPage, ProgressOption, ProgressPoint } from './types';

export function HistoryPanel(props: {
  cursors: string[];
  onNext: (cursor: string) => void;
  selectedExerciseId: string;
  onSelectExercise: (id: string) => void;
  onDeleteSession: (card: HistoryCard) => void;
}) {
  const options = useScreenData<{ items: ProgressOption[] }>('/api/progress/exercises');
  const progressExercises = useMemo(() => [...(options.data?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ru')), [options.data]);
  const selected = progressExercises.some(item => item.id === props.selectedExerciseId) ? props.selectedExerciseId : '';
  const { selectedExerciseId, onSelectExercise } = props;
  useEffect(() => {
    if (options.data && selectedExerciseId && !selected) onSelectExercise('');
  }, [options.data, selected, selectedExerciseId, onSelectExercise]);
  const points = useScreenData<ProgressPoint[]>(selected ? '/api/progress/exercises/' + encodeURIComponent(selected) : undefined);

  return (
    <section className="stack">
      <MonthCalendar />

      <section className="panel">
        <h2>Прогресс</h2>
        <ReadStatus resource={options} label="список упражнений" />
        <select value={selected} onChange={(event) => props.onSelectExercise(event.target.value)}>
          <option value="">Выберите упражнение</option>
          {progressExercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name}
            </option>
          ))}
        </select>
        <div className="progress-list">
          <ReadStatus resource={points} label="прогресс" />
          {(points.data ?? []).map((point) => (
            <div className="progress-row" key={point.sessionId}>
              <span>{new Date(point.date).toLocaleDateString('ru-RU')}</span>
              <strong>
                {point.bestWeightKg} кг x {point.bestReps}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section className="stack">
        <h2>История</h2>
        {['', ...props.cursors].map((cursor, index) => (
          <HistoryCards key={cursor} cursor={cursor} last={index === props.cursors.length}
            onNext={props.onNext} onDelete={props.onDeleteSession} />
        ))}
      </section>
    </section>
  );
}

function HistoryCards(props: { cursor: string; last: boolean; onNext: (cursor: string) => void; onDelete: (card: HistoryCard) => void }) {
  const page = useScreenData<HistoryPage>('/api/history/page' + (props.cursor ? '?cursor=' + encodeURIComponent(props.cursor) : ''));
  const next = page.data?.nextCursor;
  return <>
    <ReadStatus resource={page} label="историю тренировок" />
    {!props.cursor && page.data?.items.length === 0 && <p className="empty">Завершённых тренировок пока нет.</p>}
    {page.data?.items.map(session => (
      <article className="card" key={session.id}>
        <div className="card-header history-card-header">
          <h3>{session.completedAt ? new Date(session.completedAt).toLocaleDateString('ru-RU') : 'Тренировка'}</h3>
          <div className="history-card-actions">
            <span className="history-plan-name">{session.planTitle}</span>
            <button className="icon-button" aria-label="Удалить тренировку" onClick={() => props.onDelete(session)}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className="compact-list">
          {session.exerciseNames.map((name, index) => (
            <span key={index}>{name}</span>
          ))}
        </div>
      </article>
    ))}
    {props.last && next && <button onClick={() => props.onNext(next)}>Показать ещё</button>}
  </>;
}
