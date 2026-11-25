import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, GripVertical, ListPlus, Pencil, Play, Plus, Save, Trash2, X } from 'lucide-react';
import { api, getUserFacingApiError } from './api';
import { setTelegramVerticalSwipesEnabled } from './telegram';
import { useModalFocus } from './useModalFocus';
import { recordTemplate } from './workout-cache';
import { ScreenData, ReadStatus, useScreenData } from './screen-data';
import type { Exercise, PlanSummary, PlanList, TemplateExercise, TemplateSet, WorkoutTemplate } from './types';
import { getExerciseCountLabel, numberInputValue, parseOptionalNumberInput } from './workout-fields';

const emptyTemplate = (): Partial<WorkoutTemplate> & { exercises: TemplateExercise[] } => ({
  name: '',
  notes: '',
  exercises: []
});

function parseRequiredNumberInput(value: string) {
  return value === '' ? 0 : Number(value);
}

export function getTemplateExerciseValidationError(exercise: TemplateExercise) {
  if (exercise.sets.length === 0) return 'Добавьте хотя бы один подход.';
  if (exercise.sets.some((set) => !Number.isInteger(set.targetReps) || (set.targetReps ?? 0) <= 0)) {
    return 'Количество повторений должно быть целым числом больше нуля.';
  }
  return null;
}

export function getTemplateDraftValidationError(
  draft: Partial<WorkoutTemplate> & { exercises: TemplateExercise[] }
) {
  if (!draft.name?.trim()) return 'Введите название тренировки.';
  if (draft.exercises.length === 0) return 'Добавьте хотя бы одно упражнение.';
  return draft.exercises.map(getTemplateExerciseValidationError).find(Boolean) ?? null;
}

export function getNextTemplateSet(sets: TemplateSet[]): TemplateSet {
  const previousSet = sets.at(-1);

  return {
    type: previousSet?.type ?? 'working',
    targetWeightKg: previousSet?.targetWeightKg ?? 0,
    targetReps: previousSet?.targetReps ?? 8,
    order: sets.length
  };
}

export function getSavedTemplateExercises(
  exercises: TemplateExercise[],
  exerciseDraft: TemplateExercise,
  editingExerciseIndex: number | null
) {
  const savedExercise = {
    ...exerciseDraft,
    sets: exerciseDraft.sets.map((set, order) => ({ ...set, order }))
  };

  const nextExercises =
    editingExerciseIndex === null
      ? [...exercises, savedExercise]
      : exercises.map((exercise, index) => (index === editingExerciseIndex ? savedExercise : exercise));

  return nextExercises.map((exercise, order) => ({ ...exercise, order }));
}

export function reorderTemplateExercises(exercises: TemplateExercise[], fromIndex: number, toIndex: number) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= exercises.length ||
    toIndex >= exercises.length ||
    fromIndex === toIndex
  ) {
    return exercises.map((exercise, order) => ({ ...exercise, order }));
  }

  const nextExercises = [...exercises];
  const [movedExercise] = nextExercises.splice(fromIndex, 1);
  nextExercises.splice(toIndex, 0, movedExercise);

  return nextExercises.map((exercise, order) => ({ ...exercise, order }));
}

export function getDragAutoScrollDelta(input: { pointerY: number; containerTop: number; containerBottom: number }) {
  const edgeSize = 52;
  const maxDelta = 18;

  if (input.pointerY < input.containerTop + edgeSize) {
    const distance = Math.max(0, input.pointerY - input.containerTop);
    return -Math.ceil(((edgeSize - distance) / edgeSize) * maxDelta);
  }

  if (input.pointerY > input.containerBottom - edgeSize) {
    const distance = Math.max(0, input.containerBottom - input.pointerY);
    return Math.ceil(((edgeSize - distance) / edgeSize) * maxDelta);
  }

  return 0;
}

function TemplatePanel(props: {
  templates: PlanSummary[];
  draft: Partial<WorkoutTemplate> & { exercises: TemplateExercise[] };
  editingTemplateId: string | null;
  setDraft: (draft: Partial<WorkoutTemplate> & { exercises: TemplateExercise[] }) => void;
  onEdit: (template: PlanSummary) => void;
  onDelete: (id: string) => void;
  onSave: () => Promise<boolean>;
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  onStart: (id: string) => void;
  onCancelEdit: () => void;
}) {
  const { isDialogOpen, setIsDialogOpen } = props;
  const catalog = useScreenData<Exercise[]>(isDialogOpen ? '/api/exercises' : undefined);
  const exercises = catalog.data ?? [];
  const [dialogStep, setDialogStep] = useState<'form' | 'exercise-list' | 'exercise-detail'>('form');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [exerciseDraft, setExerciseDraft] = useState<TemplateExercise | null>(null);
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [draggingExerciseIndex, setDraggingExerciseIndex] = useState<number | null>(null);
  const draftRef = useRef(props.draft);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    currentIndex: number;
    lastPointerY: number;
    pointerId: number;
    cleanup: () => void;
  } | null>(null);
  const dragScrollFrameRef = useRef<number | null>(null);

  useEffect(() => {
    draftRef.current = props.draft;
  }, [props.draft]);

  useEffect(() => {
    return () => {
      dragStateRef.current?.cleanup();
      if (dragScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(dragScrollFrameRef.current);
      }
      setTelegramVerticalSwipesEnabled(true);
    };
  }, []);

  useEffect(() => {
    if (props.editingTemplateId) {
      setIsDialogOpen(true);
      setDialogStep('form');
    }
  }, [props.editingTemplateId, setIsDialogOpen]);

  useEffect(() => {
    if (!isDialogOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [isDialogOpen]);

  function openNewTemplate() {
    props.onCancelEdit();
    setSelectedExercise(null);
    setExerciseDraft(null);
    setEditingExerciseIndex(null);
    setDialogError(null);
    setDialogStep('form');
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setDialogStep('form');
    setSelectedExercise(null);
    setExerciseDraft(null);
    setEditingExerciseIndex(null);
    setDialogError(null);
    props.onCancelEdit();
  }

  const dialogRef = useModalFocus<HTMLElement>(isDialogOpen, closeDialog, dialogStep);

  function openExerciseDetail(exercise: Exercise) {
    setDialogError(null);
    setSelectedExercise(exercise);
    setExerciseDraft({
      exerciseId: exercise.id,
      order: props.draft.exercises.length,
      sets: [{ type: 'working', targetWeightKg: 0, targetReps: 8, order: 0 }]
    });
    setEditingExerciseIndex(null);
    setDialogStep('exercise-detail');
  }

  function editExerciseDetail(exerciseIndex: number) {
    setDialogError(null);
    const exercise = props.draft.exercises[exerciseIndex];
    const catalogExercise = exercises.find((item) => item.id === exercise.exerciseId);
    setSelectedExercise(catalogExercise ?? exercise.exercise ?? null);
    setExerciseDraft({
      ...exercise,
      sets: exercise.sets.map((set, order) => ({ ...set, order }))
    });
    setEditingExerciseIndex(exerciseIndex);
    setDialogStep('exercise-detail');
  }

  function updateExerciseSet(setIndex: number, patch: Partial<TemplateSet>) {
    if (!exerciseDraft) return;
    setDialogError(null);
    setExerciseDraft({
      ...exerciseDraft,
      sets: exerciseDraft.sets.map((set, currentIndex) =>
        currentIndex === setIndex ? { ...set, ...patch } : set
      )
    });
  }

  function saveExerciseToPlan() {
    if (!exerciseDraft) return;
    const validationError = getTemplateExerciseValidationError(exerciseDraft);
    if (validationError) {
      setDialogError(validationError);
      return;
    }
    props.setDraft({
      ...props.draft,
      exercises: getSavedTemplateExercises(props.draft.exercises, exerciseDraft, editingExerciseIndex)
    });
    setSelectedExercise(null);
    setExerciseDraft(null);
    setEditingExerciseIndex(null);
    setDialogError(null);
    setDialogStep('form');
  }

  function removeExerciseFromPlan(index: number) {
    props.setDraft({
      ...props.draft,
      exercises: props.draft.exercises
        .filter((_, currentIndex) => currentIndex !== index)
        .map((exercise, order) => ({ ...exercise, order }))
    });
  }

  function moveTemplateExercise(fromIndex: number, toIndex: number) {
    const boundedToIndex = Math.max(0, Math.min(toIndex, props.draft.exercises.length - 1));
    if (fromIndex === boundedToIndex) return;
    props.setDraft({
      ...props.draft,
      exercises: reorderTemplateExercises(props.draft.exercises, fromIndex, boundedToIndex)
    });
  }

  function finishExerciseDrag() {
    dragStateRef.current?.cleanup();
    dragStateRef.current = null;
    if (dragScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(dragScrollFrameRef.current);
      dragScrollFrameRef.current = null;
    }
    setTelegramVerticalSwipesEnabled(true);
    setDraggingExerciseIndex(null);
  }

  function updateDraggedExercisePosition(pointerY: number) {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    const targetIndex = getDragTargetIndex(pointerY);
    if (targetIndex === -1 || targetIndex === dragState.currentIndex) return;

    const reorderedExercises = reorderTemplateExercises(draftRef.current.exercises, dragState.currentIndex, targetIndex);
    const nextDraft = { ...draftRef.current, exercises: reorderedExercises };
    draftRef.current = nextDraft;
    dragState.currentIndex = targetIndex;
    setDraggingExerciseIndex(targetIndex);
    props.setDraft(nextDraft);
  }

  function runDragAutoScroll() {
    const dragState = dragStateRef.current;
    const summary = summaryRef.current;
    if (!dragState || !summary) {
      dragScrollFrameRef.current = null;
      return;
    }

    const rect = summary.getBoundingClientRect();
    const scrollDelta = getDragAutoScrollDelta({
      pointerY: dragState.lastPointerY,
      containerTop: rect.top,
      containerBottom: rect.bottom
    });

    if (scrollDelta !== 0) {
      summary.scrollTop += scrollDelta;
      updateDraggedExercisePosition(dragState.lastPointerY);
    }

    dragScrollFrameRef.current = window.requestAnimationFrame(runDragAutoScroll);
  }

  function getDragTargetIndex(pointerY: number) {
    const cards = Array.from(summaryRef.current?.querySelectorAll<HTMLElement>('[data-exercise-index]') ?? []);
    if (cards.length === 0) return -1;

    const targetIndex = cards.findIndex((card) => {
      const rect = card.getBoundingClientRect();
      return pointerY < rect.top + rect.height / 2;
    });

    return targetIndex === -1 ? cards.length - 1 : targetIndex;
  }

  function startExerciseDrag(index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    if (props.draft.exercises.length < 2 || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || pointerEvent.pointerId !== dragState.pointerId) return;
      pointerEvent.preventDefault();
      dragState.lastPointerY = pointerEvent.clientY;
      updateDraggedExercisePosition(pointerEvent.clientY);
    };

    const handlePointerUp = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== dragStateRef.current?.pointerId) return;
      finishExerciseDrag();
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    dragStateRef.current?.cleanup();
    setTelegramVerticalSwipesEnabled(false);
    dragStateRef.current = { currentIndex: index, lastPointerY: event.clientY, pointerId: event.pointerId, cleanup };
    setDraggingExerciseIndex(index);
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    dragScrollFrameRef.current = window.requestAnimationFrame(runDragAutoScroll);
  }

  function handleExerciseDragKeyDown(index: number, event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveTemplateExercise(index, index - 1);
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveTemplateExercise(index, index + 1);
    }
  }

  function goBackFromDialogStep() {
    setDialogError(null);
    if (dialogStep === 'exercise-detail') {
      setDialogStep(editingExerciseIndex === null ? 'exercise-list' : 'form');
      setSelectedExercise(null);
      setExerciseDraft(null);
      setEditingExerciseIndex(null);
      return;
    }

    setDialogStep('form');
  }

  async function savePlan() {
    if (!(await props.onSave())) return;
    setIsDialogOpen(false);
    setDialogStep('form');
    setSelectedExercise(null);
    setExerciseDraft(null);
    setEditingExerciseIndex(null);
  }

  const dialogTitle =
    dialogStep === 'exercise-list'
      ? 'Выберите упражнение'
      : dialogStep === 'exercise-detail'
        ? selectedExercise?.name ?? 'Упражнение'
        : props.editingTemplateId
          ? 'Редактировать план'
          : 'Новый план';

  return (
    <section className="stack">
      <button className="create-plan-button" onClick={openNewTemplate}>
        <Plus size={20} /> Новый план
      </button>

      <section className="stack">
        <h2>Мои планы</h2>
        {props.templates.length === 0 && <p className="empty">Планов пока нет. Создайте первый из каталога упражнений.</p>}
        {props.templates.map((template) => (
          <article className="card" key={template.id}>
            <div className="card-header">
              <div>
                <h3>{template.name}</h3>
                <span className="muted">{getExerciseCountLabel(template.exercises.length)}</span>
              </div>
              <button onClick={() => props.onStart(template.id)}>
                <Play size={18} /> Старт
              </button>
            </div>
            <div className="compact-list">
              {template.exercises.map((item) => (
                <span key={item.id}>{item.name}</span>
              ))}
            </div>
            <div className="actions">
              <button className="secondary" onClick={() => props.onEdit(template)}>
                Редактировать
              </button>
              <button className="danger" onClick={() => props.onDelete(template.id)}>
                <Trash2 size={16} /> Удалить
              </button>
            </div>
          </article>
        ))}
      </section>

      {isDialogOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="plan-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-dialog-title"
          >
            <div className="dialog-header">
              {dialogStep === 'form' ? (
                <span className="dialog-spacer" aria-hidden="true" />
              ) : (
                <button className="icon-button" aria-label="Назад" onClick={goBackFromDialogStep}>
                  <ArrowLeft size={18} />
                </button>
              )}
              <h2 id="plan-dialog-title">{dialogTitle}</h2>
              <button className="icon-button" aria-label="Закрыть" onClick={closeDialog}>
                <X size={18} />
              </button>
            </div>

            {dialogStep === 'form' && (
              <div className="dialog-body plan-form-body">
                <div className="plan-form-fields">
                  <input
                    placeholder="Название тренировки"
                    value={props.draft.name ?? ''}
                    onChange={(event) => props.setDraft({ ...props.draft, name: event.target.value })}
                  />
                  <textarea
                    placeholder="Заметки"
                    value={props.draft.notes ?? ''}
                    onChange={(event) => props.setDraft({ ...props.draft, notes: event.target.value })}
                  />
                </div>

                <div className={draggingExerciseIndex === null ? 'plan-exercise-summary' : 'plan-exercise-summary is-dragging'} ref={summaryRef}>
                  {props.draft.exercises.length === 0 ? (
                    <p className="empty">Добавьте упражнения из каталога.</p>
                  ) : (
                    props.draft.exercises.map((exercise, exerciseIndex) => {
                      const catalogExercise = exercises.find((item) => item.id === exercise.exerciseId);
                      return (
                        <article
                          className={draggingExerciseIndex === exerciseIndex ? 'exercise-summary-card dragging' : 'exercise-summary-card'}
                          data-exercise-index={exerciseIndex}
                          key={`${exercise.exerciseId}-${exerciseIndex}`}
                        >
                          <button
                            className="exercise-drag-handle"
                            aria-label="Перетащить упражнение"
                            onKeyDown={(event) => handleExerciseDragKeyDown(exerciseIndex, event)}
                            onPointerDown={(event) => startExerciseDrag(exerciseIndex, event)}
                            type="button"
                          >
                            <GripVertical size={18} />
                          </button>
                          <div className="exercise-summary-content">
                            <h3>{catalogExercise?.name ?? exercise.exercise?.name ?? 'Упражнение'}</h3>
                            <span className="muted">{exercise.sets.length} подходов</span>
                          </div>
                          <div className="exercise-summary-actions">
                            <button className="icon-button" aria-label="Редактировать упражнение" onClick={() => editExerciseDetail(exerciseIndex)}>
                              <Pencil size={17} />
                            </button>
                            <button className="icon-button" aria-label="Удалить упражнение" onClick={() => removeExerciseFromPlan(exerciseIndex)}>
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>

                <div className="actions dialog-actions">
                  {catalog.data?.length === 0 && <p className="empty">Каталог упражнений пока пуст.</p>}
                  <ReadStatus resource={catalog} label="каталог упражнений" />
                  <button className="secondary" disabled={exercises.length === 0} onClick={() => setDialogStep('exercise-list')}>
                    <ListPlus size={18} /> Упражнение
                  </button>
                  <button onClick={savePlan}>
                    <Save size={18} /> Сохранить
                  </button>
                </div>
              </div>
            )}

            {dialogStep === 'exercise-list' && (
              <div className="exercise-picker-list">
                {exercises.map((exercise) => (
                  <button className="exercise-picker-row" key={exercise.id} onClick={() => openExerciseDetail(exercise)}>
                    <span>
                      <strong>{exercise.name}</strong>
                      <small>
                        {exercise.muscleGroup} · {exercise.equipment}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {dialogStep === 'exercise-detail' && exerciseDraft && (
              <div className="dialog-body exercise-detail-body">
                {selectedExercise?.techniqueNote && <p className="muted">{selectedExercise.techniqueNote}</p>}

                <div className="exercise-block exercise-sets-panel">
                  <div className="exercise-sets-list">
                    {exerciseDraft.sets.map((set, setIndex) => (
                      <div className="set-row" key={setIndex}>
                        <select value={set.type} onChange={(event) => updateExerciseSet(setIndex, { type: event.target.value as TemplateSet['type'] })}>
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
                            value={numberInputValue(set.targetWeightKg)}
                            onChange={(event) => updateExerciseSet(setIndex, { targetWeightKg: parseRequiredNumberInput(event.target.value) })}
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
                            value={numberInputValue(set.targetReps)}
                            aria-invalid={set.targetReps === null || !Number.isInteger(set.targetReps) || set.targetReps <= 0}
                            onChange={(event) => updateExerciseSet(setIndex, { targetReps: parseOptionalNumberInput(event.target.value) })}
                          />
                          <span>п.</span>
                        </label>
                        <button
                          className="icon-button"
                          aria-label="Удалить подход"
                          onClick={() =>
                            setExerciseDraft({
                              ...exerciseDraft,
                              sets: exerciseDraft.sets.filter((_, index) => index !== setIndex).map((item, order) => ({ ...item, order }))
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {dialogError ? (
                    <p className="form-error" role="alert">
                      {dialogError}
                    </p>
                  ) : null}
                  <button
                    className="secondary"
                    onClick={() =>
                      setExerciseDraft({
                        ...exerciseDraft,
                        sets: [...exerciseDraft.sets, getNextTemplateSet(exerciseDraft.sets)]
                      })
                    }
                  >
                    <Plus size={16} /> Подход
                  </button>
                </div>

                <div className="exercise-detail-actions">
                  <button disabled={exerciseDraft.sets.length === 0} onClick={saveExerciseToPlan}>
                    <Save size={18} /> {editingExerciseIndex === null ? 'Сохранить упражнение' : 'Готово'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export function PlansScreen({ visible, store, setMessage, onStart, changedExercise }: {
  visible: boolean; store: ScreenData; setMessage: (message: string) => void;
  onStart: (id: string) => void; changedExercise: Exercise | null;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const plans = useScreenData<PlanList>(visible ? '/api/templates/summary' : undefined);
  const [templateDraft, setTemplateDraft] = useState(emptyTemplate);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [requestedId, setRequestedId] = useState<string | null>(null);
  const detail = useScreenData<WorkoutTemplate>(visible && requestedId ? '/api/templates/' + encodeURIComponent(requestedId) : undefined);
  useEffect(() => {
    if (!detail.data || detail.data.id !== requestedId) return;
    setTemplateDraft(detail.data);
    setEditingTemplateId(detail.data.id);
    setRequestedId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [detail.data, requestedId]);
  useEffect(() => {
    if (changedExercise) setTemplateDraft(current => ({
      ...current, exercises: current.exercises.map(row => row.exerciseId === changedExercise.id ? { ...row, exercise: changedExercise } : row)
    }));
  }, [changedExercise]);

  async function saveTemplate() {
    const validationError = getTemplateDraftValidationError(templateDraft);
    if (validationError) {
      setMessage(validationError);
      return false;
    }

    const payload = {
      name: templateDraft.name,
      notes: templateDraft.notes,
      exercises: templateDraft.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        order: exercise.order,
        sets: exercise.sets
      }))
    };

    try {
      const saved = editingTemplateId
        ? await api.patch<WorkoutTemplate>(`/api/templates/${editingTemplateId}`, payload)
        : await api.post<WorkoutTemplate>('/api/templates', payload);
      recordTemplate(store, saved.id, saved);
      setMessage(editingTemplateId ? 'Шаблон обновлён' : 'Шаблон создан');
    } catch (error) {
      setMessage(getUserFacingApiError(error, 'Не удалось сохранить план. Попробуйте ещё раз.'));
      return false;
    }

    setTemplateDraft(emptyTemplate());
    setEditingTemplateId(null);
    return true;
  }

  if (!visible) return null;
  return <>
    <ReadStatus resource={plans} label="планы" />
    <ReadStatus resource={detail} label="выбранный план" />
    {plans.data && (
      <TemplatePanel
        isDialogOpen={isDialogOpen}
        setIsDialogOpen={setIsDialogOpen}
        templates={plans.data.items}
        draft={templateDraft}
        editingTemplateId={editingTemplateId}
        setDraft={setTemplateDraft}
        onEdit={template => setRequestedId(template.id)}
        onDelete={async (id) => {
          try {
            await api.delete(`/api/templates/${id}`);
            recordTemplate(store, id);
          } catch (error) {
            setMessage(getUserFacingApiError(error, 'Не удалось удалить план.'));
          }
        }}
        onSave={saveTemplate}
        onStart={onStart}
        onCancelEdit={() => {
          setRequestedId(null);
          setEditingTemplateId(null);
          setTemplateDraft(emptyTemplate());
        }}
      />
    )}
  </>;
}
