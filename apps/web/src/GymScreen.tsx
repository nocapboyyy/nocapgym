import { useEffect, useState, useSyncExternalStore } from 'react';
import { Check, ChevronDown, CircleCheck, ListPlus, Play, Plus, Trash2, X } from 'lucide-react';
import { useModalFocus } from './useModalFocus';
import { ReadStatus, useScreenData } from './screen-data';
import type { Exercise, PlanSummary, PlanList, SessionExercise, SessionSet, WorkoutSession, WorkoutTemplate } from './types';
import { SessionDraft } from './session-draft';
import { getExerciseCountLabel, numberInputValue, parseOptionalNumberInput } from './workout-fields';

export function isSessionExerciseComplete(exercise: Pick<SessionExercise, 'sets'>) {
  return exercise.sets.length > 0 && exercise.sets.every((set) => set.completed);
}

export function getInitialExerciseDisclosureState(count: number) {
  return Array.from({ length: count }, (_, index) => index === 0);
}

export function toggleExerciseDisclosureState(state: boolean[], index: number) {
  return state.map((isExpanded, currentIndex) => (currentIndex === index ? !isExpanded : isExpanded));
}

export function appendExpandedExerciseDisclosureState(state: boolean[]) {
  return [...state, true];
}

export function removeExerciseDisclosureState(state: boolean[], index: number) {
  return state.filter((_, currentIndex) => currentIndex !== index);
}

export function normalizeSessionExercises(exercises: SessionExercise[]) {
  return exercises.map((exercise, order) => ({ ...exercise, order }));
}

export function getSessionExerciseTitle(
  exercise: Pick<SessionExercise, 'exerciseId' | 'exercise'>,
  exercises: Exercise[]
) {
  return exercises.find((item) => item.id === exercise.exerciseId)?.name ?? exercise.exercise?.name ?? 'Упражнение';
}

export async function completeWorkoutRequest(input: {
  session: WorkoutSession;
  applyToTemplate: boolean;
  post: (path: string, body: unknown) => Promise<WorkoutSession & { updatedTemplate?: WorkoutTemplate }>;
}) {
  return input.post(`/api/sessions/${input.session.id}/complete`, {
    exercises: input.session.exercises,
    applyToTemplate: input.applyToTemplate
  });
}

export function getSessionCompletionValidationError(session: WorkoutSession) {
  const invalidCompletedSet = session.exercises.some((exercise) =>
    exercise.sets.some(
      (set) => set.completed && (!Number.isInteger(set.actualReps) || (set.actualReps ?? 0) <= 0)
    )
  );
  return invalidCompletedSet ? 'Для каждого завершённого подхода укажите повторы больше нуля.' : null;
}

export function SessionPanel(props: {
  session: WorkoutSession | null;
  exercises: Exercise[];
  templates: PlanSummary[];
  setSession: (session: WorkoutSession | null) => void;
  onComplete: (applyToTemplate: boolean) => void;
  onStart: (templateId: string) => void;
  onOpenTemplates: () => void;
  initialPlanPickerOpen?: boolean;
}) {
  const [isPlanPickerOpen, setIsPlanPickerOpen] = useState(props.initialPlanPickerOpen ?? false);
  const [expandedExercises, setExpandedExercises] = useState(() =>
    getInitialExerciseDisclosureState(props.session?.exercises.length ?? 0)
  );
  const sessionExerciseCount = props.session?.exercises.length ?? 0;
  const closePlanPicker = () => setIsPlanPickerOpen(false);
  const planPickerDialogRef = useModalFocus<HTMLElement>(isPlanPickerOpen, closePlanPicker);

  useEffect(() => {
    setExpandedExercises(getInitialExerciseDisclosureState(sessionExerciseCount));
  }, [props.session?.id, sessionExerciseCount]);

  if (!props.session) {
    return (
      <section className="stack">
        <section className="panel session-start-panel">
          <div>
            <h2>Готовы к тренировке?</h2>
            <p className="muted">Выберите план и начните занятие прямо из зала.</p>
          </div>
          <button disabled={props.templates.length === 0} onClick={() => setIsPlanPickerOpen(true)}>
            <Play size={18} /> Начать тренировку
          </button>
          {props.templates.length === 0 && (
            <div className="session-start-empty">
              <span>Планов пока нет.</span>
              <button className="secondary" onClick={props.onOpenTemplates}>
                <Plus size={18} /> Создать план
              </button>
            </div>
          )}
        </section>

        {isPlanPickerOpen && (
          <div className="modal-backdrop" role="presentation">
            <section
              className="plan-dialog session-plan-dialog"
              ref={planPickerDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="session-plan-dialog-title"
            >
              <div className="dialog-header">
                <span className="dialog-spacer" aria-hidden="true" />
                <h2 id="session-plan-dialog-title">Выберите план</h2>
                <button className="icon-button" aria-label="Закрыть" onClick={closePlanPicker}>
                  <X size={18} />
                </button>
              </div>
              <div className="dialog-body session-plan-list">
                {props.templates.map((template) => (
                  <article className="card session-plan-card" key={template.id}>
                    <div className="card-header">
                      <div>
                        <h3>{template.name}</h3>
                        <span className="muted">{getExerciseCountLabel(template.exercises.length)}</span>
                      </div>
                      <button
                        onClick={() => {
                          closePlanPicker();
                          props.onStart(template.id);
                        }}
                      >
                        <Play size={18} /> Старт
                      </button>
                    </div>
                    <div className="compact-list">
                      {template.exercises.map((item) => (
                        <span key={item.id}>
                          {item.name}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    );
  }

  function updateExercise(index: number, patch: Partial<SessionExercise>) {
    props.setSession({
      ...props.session!,
      exercises: props.session!.exercises.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    });
  }

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<SessionSet>) {
    const exercise = props.session!.exercises[exerciseIndex];
    updateExercise(exerciseIndex, {
      sets: exercise.sets.map((set, currentIndex) => (currentIndex === setIndex ? { ...set, ...patch } : set))
    });
  }

  return (
    <section className="stack">
      <div className="panel-title">
        <h2>Текущая тренировка</h2>
      </div>

      {props.session.exercises.map((exercise, exerciseIndex) => {
        const isExpanded = expandedExercises[exerciseIndex] ?? false;

        return (
          <article className="card session-exercise-card" key={`${exercise.exerciseId}-${exerciseIndex}`}>
            <button
              className="session-exercise-header"
              aria-expanded={isExpanded}
              onClick={() =>
                setExpandedExercises((state) => toggleExerciseDisclosureState(state, exerciseIndex))
              }
            >
              <span className="session-exercise-title">{getSessionExerciseTitle(exercise, props.exercises)}</span>
              {isSessionExerciseComplete(exercise) && (
                <span className="exercise-complete-indicator" aria-label="Все подходы выполнены">
                  <CircleCheck size={17} />
                </span>
              )}
              <ChevronDown className="session-exercise-chevron" size={20} aria-hidden="true" />
            </button>

            {isExpanded && (
              <div className="session-exercise-content">
                <div className="row">
                  <select value={exercise.exerciseId} onChange={(event) => updateExercise(exerciseIndex, { exerciseId: event.target.value })}>
                    {!props.exercises.some(item => item.id === exercise.exerciseId) && (
                      <option value={exercise.exerciseId}>{getSessionExerciseTitle(exercise, props.exercises)}</option>
                    )}
                    {props.exercises.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="icon-button"
                    aria-label="Удалить упражнение"
                    onClick={() => {
                      setExpandedExercises((state) => removeExerciseDisclosureState(state, exerciseIndex));
                      props.setSession({
                        ...props.session!,
                        exercises: normalizeSessionExercises(
                          props.session!.exercises.filter((_, index) => index !== exerciseIndex)
                        )
                      });
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                {exercise.sets.map((set, setIndex) => (
                  <div className="set-row session-set" key={setIndex}>
                    <select value={set.type} onChange={(event) => updateSet(exerciseIndex, setIndex, { type: event.target.value as SessionSet['type'] })}>
                      <option value="warmup">Разм.</option>
                      <option value="working">Раб.</option>
                    </select>
                    <label className="unit-field">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="0"
                        placeholder="0 кг"
                        value={numberInputValue(set.actualWeightKg)}
                        onChange={(event) =>
                          updateSet(exerciseIndex, setIndex, { actualWeightKg: parseOptionalNumberInput(event.target.value) })
                        }
                      />
                      <span>кг</span>
                    </label>
                    <label className="unit-field">
                      <input
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="1"
                        placeholder="0 п."
                        value={numberInputValue(set.actualReps)}
                        onChange={(event) =>
                          updateSet(exerciseIndex, setIndex, { actualReps: parseOptionalNumberInput(event.target.value) })
                        }
                      />
                      <span>п.</span>
                    </label>
                    <button
                      className={set.completed ? 'icon-button done' : 'icon-button'}
                      aria-label="Отметить подход"
                      onClick={() => updateSet(exerciseIndex, setIndex, { completed: !set.completed })}
                    >
                      <Check size={18} />
                    </button>
                  </div>
                ))}

                <button
                  className="secondary"
                  onClick={() =>
                    updateExercise(exerciseIndex, {
                      sets: [
                        ...exercise.sets,
                        {
                          type: 'working',
                          plannedWeightKg: null,
                          plannedReps: null,
                          actualWeightKg: 0,
                          actualReps: 8,
                          completed: false,
                          order: exercise.sets.length
                        }
                      ]
                    })
                  }
                >
                  <Plus size={16} /> Подход
                </button>
              </div>
            )}
          </article>
        );
      })}

      <button
        className="secondary"
        disabled={props.exercises.length === 0}
        onClick={() => {
          setExpandedExercises((state) => appendExpandedExerciseDisclosureState(state));
          props.setSession({
            ...props.session!,
            exercises: [
              ...props.session!.exercises,
              {
                exerciseId: props.exercises[0].id,
                order: props.session!.exercises.length,
                sets: [
                  {
                    type: 'working',
                    plannedWeightKg: null,
                    plannedReps: null,
                    actualWeightKg: 0,
                    actualReps: 8,
                    completed: false,
                    order: 0
                  }
                ]
              }
            ]
          });
        }}
      >
        <ListPlus size={18} /> Добавить упражнение
      </button>

      <div className="finish-panel">
        <button onClick={() => props.onComplete(false)}>
          <Check size={18} /> Завершить
        </button>
        <button className="secondary" onClick={() => props.onComplete(true)}>
          Завершить и обновить план
        </button>
      </div>
    </section>
  );
}


export function GymScreen(props: {
  draft: SessionDraft;
  onStart: (id: string) => void;
  onComplete: (apply: boolean) => void;
  onOpenTemplates: () => void;
}) {
  const session = useSyncExternalStore(props.draft.subscribe, props.draft.read, props.draft.read);
  const plans = useScreenData<PlanList>(session ? undefined : '/api/templates/summary');
  const catalog = useScreenData<Exercise[]>(session ? '/api/exercises' : undefined);
  return <>
    <ReadStatus resource={plans} label="планы" />
    <ReadStatus resource={catalog} label="каталог упражнений" />
    {(session || plans.data) && <SessionPanel key={session?.id ?? 'picker'} session={session}
      setSession={props.draft.write} exercises={catalog.data ?? []} templates={plans.data?.items ?? []}
      onStart={props.onStart} onComplete={props.onComplete} onOpenTemplates={props.onOpenTemplates} />}
  </>;
}
