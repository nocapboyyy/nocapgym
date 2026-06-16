import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  Dumbbell,
  History,
  ListPlus,
  Play,
  Plus,
  Save,
  Shield,
  Trash2,
  X
} from 'lucide-react';
import { api } from './api';
import { initTelegramApp } from './telegram';
import type {
  Exercise,
  ProgressPoint,
  SessionExercise,
  SessionSet,
  TemplateExercise,
  TemplateSet,
  User,
  WorkoutSession,
  WorkoutTemplate
} from './types';

export type Tab = 'templates' | 'session' | 'history' | 'admin';

const tabLabels: Record<Tab, string> = {
  templates: 'Планы',
  session: 'Зал',
  history: 'История',
  admin: 'Админ'
};

export function getTabTitle(tab: Tab) {
  return tabLabels[tab];
}

export function getKeyboardViewportState(input: {
  windowInnerHeight: number;
  visualViewportHeight?: number;
  telegramViewportHeight?: number;
  visualViewportOffsetTop?: number;
}) {
  const viewportHeight = Math.min(
    ...[input.visualViewportHeight, input.telegramViewportHeight, input.windowInnerHeight].filter(
      (height): height is number => typeof height === 'number' && height > 0
    )
  );
  const keyboardOffset = Math.max(0, input.windowInnerHeight - viewportHeight - (input.visualViewportOffsetTop ?? 0));

  return {
    viewportHeight,
    keyboardOffset,
    keyboardSpace: Math.min(keyboardOffset, 220),
    keyboardLift: -Math.min(keyboardOffset * 0.58, 220),
    isKeyboardOpen: keyboardOffset > 80
  };
}

export function getBottomControlsHidden(input: { isKeyboardOpen: boolean; isEditableFocused: boolean }) {
  return input.isKeyboardOpen || input.isEditableFocused;
}

function isEditableElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false;
  return element.matches('input, textarea, select, [contenteditable="true"]');
}

const emptyTemplate = (): Partial<WorkoutTemplate> & { exercises: TemplateExercise[] } => ({
  name: '',
  notes: '',
  exercises: []
});

function numberInputValue(value: number | null | undefined) {
  return value === null || value === undefined || value === 0 ? '' : String(value);
}

function parseNumberInput(value: string) {
  return value === '' ? 0 : Number(value);
}

export function App() {
  const [tab, setTab] = useState<Tab>('templates');
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [adminExercises, setAdminExercises] = useState<Exercise[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [templateDraft, setTemplateDraft] = useState(emptyTemplate());
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [selectedProgressExerciseId, setSelectedProgressExerciseId] = useState('');
  const [progress, setProgress] = useState<ProgressPoint[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [editableFocused, setEditableFocused] = useState(false);

  useEffect(() => {
    initTelegramApp();
    void loadInitialData();
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    function updateViewportVars() {
      const viewport = window.visualViewport;
      const viewportState = getKeyboardViewportState({
        windowInnerHeight: window.innerHeight,
        visualViewportHeight: viewport?.height,
        telegramViewportHeight: window.Telegram?.WebApp.viewportHeight,
        visualViewportOffsetTop: viewport?.offsetTop
      });
      root.style.setProperty('--app-viewport-height', `${viewportState.viewportHeight}px`);
      root.style.setProperty('--keyboard-offset', `${viewportState.keyboardOffset}px`);
      root.style.setProperty('--keyboard-space', `${viewportState.keyboardSpace}px`);
      root.style.setProperty('--keyboard-lift', `${viewportState.keyboardLift}px`);
      setKeyboardOpen(viewportState.isKeyboardOpen);
    }

    updateViewportVars();
    window.visualViewport?.addEventListener('resize', updateViewportVars);
    window.visualViewport?.addEventListener('scroll', updateViewportVars);
    window.addEventListener('resize', updateViewportVars);
    window.Telegram?.WebApp.onEvent?.('viewportChanged', updateViewportVars);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewportVars);
      window.visualViewport?.removeEventListener('scroll', updateViewportVars);
      window.removeEventListener('resize', updateViewportVars);
      window.Telegram?.WebApp.offEvent?.('viewportChanged', updateViewportVars);
      root.style.removeProperty('--app-viewport-height');
      root.style.removeProperty('--keyboard-offset');
      root.style.removeProperty('--keyboard-space');
      root.style.removeProperty('--keyboard-lift');
    };
  }, []);

  useEffect(() => {
    function updateEditableFocus() {
      setEditableFocused(isEditableElement(document.activeElement));
    }

    function handleFocusOut() {
      window.setTimeout(updateEditableFocus, 0);
    }

    document.addEventListener('focusin', updateEditableFocus);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', updateEditableFocus);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [message]);

  async function loadInitialData() {
    setLoading(true);
    const [me, exerciseList, templateList, historyList] = await Promise.all([
      api.get<{ user: User; isAdmin: boolean }>('/api/me'),
      api.get<Exercise[]>('/api/exercises'),
      api.get<WorkoutTemplate[]>('/api/templates'),
      api.get<WorkoutSession[]>('/api/history')
    ]);

    setUser(me.user);
    setIsAdmin(me.isAdmin);
    setExercises(exerciseList);
    setTemplates(templateList);
    setHistory(historyList);
    if (me.isAdmin) {
      setAdminExercises(await api.get<Exercise[]>('/api/admin/exercises'));
    }
    setLoading(false);
  }

  async function refreshTemplates() {
    setTemplates(await api.get<WorkoutTemplate[]>('/api/templates'));
  }

  async function refreshHistory() {
    setHistory(await api.get<WorkoutSession[]>('/api/history'));
  }

  async function saveTemplate() {
    if (!templateDraft.name?.trim()) return setMessage('Введите название тренировки');
    if (templateDraft.exercises.length === 0) return setMessage('Добавьте хотя бы одно упражнение');

    const payload = {
      name: templateDraft.name,
      notes: templateDraft.notes,
      exercises: templateDraft.exercises
    };

    if (editingTemplateId) {
      await api.patch<WorkoutTemplate>(`/api/templates/${editingTemplateId}`, payload);
      setMessage('Шаблон обновлён');
    } else {
      await api.post<WorkoutTemplate>('/api/templates', payload);
      setMessage('Шаблон создан');
    }

    setTemplateDraft(emptyTemplate());
    setEditingTemplateId(null);
    await refreshTemplates();
  }

  async function startSession(templateId: string) {
    const session = await api.post<WorkoutSession>('/api/sessions/start', { templateId });
    setActiveSession(session);
    setTab('session');
  }

  async function completeSession(applyToTemplate: boolean) {
    if (!activeSession) return;
    const saved = await api.patch<WorkoutSession>(`/api/sessions/${activeSession.id}`, {
      exercises: activeSession.exercises
    });
    const completed = await api.post<WorkoutSession>(`/api/sessions/${saved.id}/complete`);
    if (applyToTemplate) {
      await api.post(`/api/sessions/${completed.id}/apply-to-template`);
      await refreshTemplates();
    }
    setActiveSession(null);
    setTab('history');
    setMessage(applyToTemplate ? 'Тренировка завершена, шаблон обновлён' : 'Тренировка завершена');
    await refreshHistory();
  }

  async function loadProgress(exerciseId: string) {
    setSelectedProgressExerciseId(exerciseId);
    setProgress(exerciseId ? await api.get<ProgressPoint[]>(`/api/progress/exercises/${exerciseId}`) : []);
  }

  async function exportBackup() {
    const payload = await api.get<unknown>('/api/export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `gym-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file: File) {
    const payload = JSON.parse(await file.text());
    await api.post('/api/import', payload);
    await Promise.all([refreshTemplates(), refreshHistory()]);
    setMessage('Backup импортирован');
  }

  async function deleteHistorySession(sessionId: string) {
    if (!window.confirm('Удалить тренировку из истории?')) return;
    await api.delete(`/api/sessions/${sessionId}`);
    await refreshHistory();
    if (selectedProgressExerciseId) {
      await loadProgress(selectedProgressExerciseId);
    }
    setMessage('Тренировка удалена');
  }

  const tabs = useMemo(
    () => [
      { id: 'templates' as const, label: getTabTitle('templates'), icon: Dumbbell },
      { id: 'session' as const, label: getTabTitle('session'), icon: Activity },
      { id: 'history' as const, label: getTabTitle('history'), icon: History },
      ...(isAdmin ? [{ id: 'admin' as const, label: getTabTitle('admin'), icon: Shield }] : [])
    ],
    [isAdmin]
  );
  const completedSessionsCount = history.length;
  const plannedExercisesCount = templates.reduce((total, template) => total + template.exercises.length, 0);
  const activeSetsCount = activeSession?.exercises.reduce((total, exercise) => total + exercise.sets.length, 0) ?? 0;
  const bottomControlsHidden = getBottomControlsHidden({ isKeyboardOpen: keyboardOpen, isEditableFocused: editableFocused });

  if (loading) {
    return <main className="app-shell centered">Загрузка...</main>;
  }

  return (
    <main className={bottomControlsHidden ? 'app-shell bottom-controls-hidden' : 'app-shell'}>
      <header className="topbar">
        <div>
          <span className="eyebrow">NOCAPGYM</span>
          <h1>{getTabTitle(tab)}</h1>
        </div>
        <div className="profile">{user?.firstName ?? user?.username ?? 'Пользователь'}</div>
      </header>

      {message && (
        <button className="toast" onClick={() => setMessage('')}>
          {message}
        </button>
      )}

      <nav className="tabbar">
        {tabs.map((item) => (
          <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </nav>

      <section className="dashboard-strip" aria-label="Сводка">
        <div>
          <span className="metric-label">Планы</span>
          <strong>{templates.length}</strong>
        </div>
        <div>
          <span className="metric-label">В плане</span>
          <strong>{plannedExercisesCount}</strong>
        </div>
        <div>
          <span className="metric-label">История</span>
          <strong>{completedSessionsCount}</strong>
        </div>
        <div>
          <span className="metric-label">Сейчас</span>
          <strong>{activeSetsCount}</strong>
        </div>
      </section>

      {tab === 'templates' && (
        <TemplatePanel
          exercises={exercises}
          templates={templates}
          draft={templateDraft}
          editingTemplateId={editingTemplateId}
          setDraft={setTemplateDraft}
          onEdit={(template) => {
            setEditingTemplateId(template.id);
            setTemplateDraft({
              name: template.name,
              notes: template.notes,
              exercises: template.exercises.map((exercise) => ({
                exerciseId: exercise.exerciseId,
                order: exercise.order,
                sets: exercise.sets
              }))
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onDelete={async (id) => {
            await api.delete(`/api/templates/${id}`);
            await refreshTemplates();
          }}
          onSave={saveTemplate}
          onStart={startSession}
          onCancelEdit={() => {
            setEditingTemplateId(null);
            setTemplateDraft(emptyTemplate());
          }}
        />
      )}

      {tab === 'session' && (
        <SessionPanel
          session={activeSession}
          exercises={exercises}
          setSession={setActiveSession}
          onComplete={completeSession}
        />
      )}

      {tab === 'history' && (
        <HistoryPanel
          exercises={exercises}
          history={history}
          progress={progress}
          selectedExerciseId={selectedProgressExerciseId}
          onSelectExercise={loadProgress}
          onDeleteSession={deleteHistorySession}
          onExport={exportBackup}
          onImport={importBackup}
        />
      )}

      {tab === 'admin' && isAdmin && (
        <AdminPanel
          exercises={adminExercises}
          reload={async () => {
            setAdminExercises(await api.get<Exercise[]>('/api/admin/exercises'));
            setExercises(await api.get<Exercise[]>('/api/exercises'));
          }}
        />
      )}
    </main>
  );
}

function TemplatePanel(props: {
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  draft: Partial<WorkoutTemplate> & { exercises: TemplateExercise[] };
  editingTemplateId: string | null;
  setDraft: (draft: Partial<WorkoutTemplate> & { exercises: TemplateExercise[] }) => void;
  onEdit: (template: WorkoutTemplate) => void;
  onDelete: (id: string) => void;
  onSave: () => void | Promise<void>;
  onStart: (id: string) => void;
  onCancelEdit: () => void;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<'form' | 'exercise-list' | 'exercise-detail'>('form');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [exerciseDraft, setExerciseDraft] = useState<TemplateExercise | null>(null);

  useEffect(() => {
    if (props.editingTemplateId) {
      setIsDialogOpen(true);
      setDialogStep('form');
    }
  }, [props.editingTemplateId]);

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
    setDialogStep('form');
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setDialogStep('form');
    setSelectedExercise(null);
    setExerciseDraft(null);
    props.onCancelEdit();
  }

  function openExerciseDetail(exercise: Exercise) {
    setSelectedExercise(exercise);
    setExerciseDraft({
      exerciseId: exercise.id,
      order: props.draft.exercises.length,
      sets: [{ type: 'working', targetWeightKg: 0, targetReps: 8, order: 0 }]
    });
    setDialogStep('exercise-detail');
  }

  function updateExerciseSet(setIndex: number, patch: Partial<TemplateSet>) {
    if (!exerciseDraft) return;
    setExerciseDraft({
      ...exerciseDraft,
      sets: exerciseDraft.sets.map((set, currentIndex) =>
        currentIndex === setIndex ? { ...set, ...patch } : set
      )
    });
  }

  function saveExerciseToPlan() {
    if (!exerciseDraft) return;
    props.setDraft({
      ...props.draft,
      exercises: [
        ...props.draft.exercises,
        {
          ...exerciseDraft,
          order: props.draft.exercises.length,
          sets: exerciseDraft.sets.map((set, order) => ({ ...set, order }))
        }
      ]
    });
    setSelectedExercise(null);
    setExerciseDraft(null);
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

  async function savePlan() {
    if (!props.draft.name?.trim() || props.draft.exercises.length === 0) {
      await props.onSave();
      return;
    }
    await props.onSave();
    setIsDialogOpen(false);
    setDialogStep('form');
    setSelectedExercise(null);
    setExerciseDraft(null);
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
                <span className="muted">{template.exercises.length} упражнений</span>
              </div>
              <button onClick={() => props.onStart(template.id)}>
                <Play size={18} /> Старт
              </button>
            </div>
            <div className="compact-list">
              {template.exercises.map((item) => (
                <span key={item.id}>{item.exercise?.name ?? 'Упражнение'}</span>
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
          <section className="plan-dialog" role="dialog" aria-modal="true" aria-labelledby="plan-dialog-title">
            <div className="dialog-header">
              {dialogStep === 'form' ? (
                <span className="dialog-spacer" aria-hidden="true" />
              ) : (
                <button className="icon-button" aria-label="Назад" onClick={() => setDialogStep(dialogStep === 'exercise-detail' ? 'exercise-list' : 'form')}>
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

                <div className="plan-exercise-summary">
                  {props.draft.exercises.length === 0 ? (
                    <p className="empty">Добавьте упражнения из каталога.</p>
                  ) : (
                    props.draft.exercises.map((exercise, exerciseIndex) => {
                      const catalogExercise = props.exercises.find((item) => item.id === exercise.exerciseId);
                      return (
                        <article className="exercise-summary-card" key={`${exercise.exerciseId}-${exerciseIndex}`}>
                          <div>
                            <h3>{catalogExercise?.name ?? 'Упражнение'}</h3>
                            <span className="muted">{exercise.sets.length} подходов</span>
                          </div>
                          <button className="icon-button" aria-label="Удалить упражнение" onClick={() => removeExerciseFromPlan(exerciseIndex)}>
                            <Trash2 size={17} />
                          </button>
                        </article>
                      );
                    })
                  )}
                </div>

                <div className="actions dialog-actions">
                  <button className="secondary" disabled={props.exercises.length === 0} onClick={() => setDialogStep('exercise-list')}>
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
                {props.exercises.map((exercise) => (
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
                            placeholder="0 кг"
                            value={numberInputValue(set.targetWeightKg)}
                            onChange={(event) => updateExerciseSet(setIndex, { targetWeightKg: parseNumberInput(event.target.value) })}
                          />
                          <span>кг</span>
                        </label>
                        <label className="unit-field">
                          <input
                            type="number"
                            inputMode="numeric"
                            step="1"
                            placeholder="0 п."
                            value={numberInputValue(set.targetReps)}
                            onChange={(event) => updateExerciseSet(setIndex, { targetReps: parseNumberInput(event.target.value) })}
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
                  <button
                    className="secondary"
                    onClick={() =>
                      setExerciseDraft({
                        ...exerciseDraft,
                        sets: [
                          ...exerciseDraft.sets,
                          { type: 'working', targetWeightKg: 0, targetReps: 8, order: exerciseDraft.sets.length }
                        ]
                      })
                    }
                  >
                    <Plus size={16} /> Подход
                  </button>
                </div>

                <div className="exercise-detail-actions">
                  <button disabled={exerciseDraft.sets.length === 0} onClick={saveExerciseToPlan}>
                    <Save size={18} /> Сохранить упражнение
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

function SessionPanel(props: {
  session: WorkoutSession | null;
  exercises: Exercise[];
  setSession: (session: WorkoutSession | null) => void;
  onComplete: (applyToTemplate: boolean) => void;
}) {
  if (!props.session) {
    return <section className="panel empty">Запустите тренировку из вкладки «Планы».</section>;
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

      {props.session.exercises.map((exercise, exerciseIndex) => (
        <article className="card" key={`${exercise.exerciseId}-${exerciseIndex}`}>
          <div className="row">
            <select value={exercise.exerciseId} onChange={(event) => updateExercise(exerciseIndex, { exerciseId: event.target.value })}>
              {props.exercises.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              className="icon-button"
              aria-label="Удалить упражнение"
              onClick={() =>
                props.setSession({
                  ...props.session!,
                  exercises: props.session!.exercises.filter((_, index) => index !== exerciseIndex)
                })
              }
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
                  placeholder="0 кг"
                  value={numberInputValue(set.actualWeightKg)}
                  onChange={(event) =>
                    updateSet(exerciseIndex, setIndex, { actualWeightKg: parseNumberInput(event.target.value) })
                  }
                />
                <span>кг</span>
              </label>
              <label className="unit-field">
                <input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  placeholder="0 п."
                  value={numberInputValue(set.actualReps)}
                  onChange={(event) =>
                    updateSet(exerciseIndex, setIndex, { actualReps: parseNumberInput(event.target.value) })
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
        </article>
      ))}

      <button
        className="secondary"
        disabled={props.exercises.length === 0}
        onClick={() =>
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
          })
        }
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

function HistoryPanel(props: {
  exercises: Exercise[];
  history: WorkoutSession[];
  progress: ProgressPoint[];
  selectedExerciseId: string;
  onSelectExercise: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
}) {
  return (
    <section className="stack">
      <section className="panel">
        <h2>Backup</h2>
        <div className="actions">
          <button onClick={props.onExport}>
            <Save size={18} /> Экспорт JSON
          </button>
          <label className="file-button">
            Импорт JSON
            <input
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void props.onImport(file);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>Прогресс</h2>
        <select value={props.selectedExerciseId} onChange={(event) => props.onSelectExercise(event.target.value)}>
          <option value="">Выберите упражнение</option>
          {props.exercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name}
            </option>
          ))}
        </select>
        <div className="progress-list">
          {props.progress.map((point) => (
            <div className="progress-row" key={point.date}>
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
        {props.history.length === 0 && <p className="empty">Завершённых тренировок пока нет.</p>}
        {props.history.map((session) => (
          <article className="card" key={session.id}>
            <div className="card-header">
              <h3>{session.completedAt ? new Date(session.completedAt).toLocaleDateString('ru-RU') : 'Тренировка'}</h3>
              <div className="history-card-actions">
                <BarChart3 size={18} />
                <button className="icon-button" aria-label="Удалить тренировку" onClick={() => props.onDeleteSession(session.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="compact-list">
              {session.exercises.map((exercise) => (
                <span key={exercise.id}>{exercise.exercise?.name ?? 'Упражнение'}</span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}

function AdminPanel(props: { exercises: Exercise[]; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState({
    name: '',
    muscleGroup: '',
    equipment: '',
    techniqueNote: '',
    isHidden: false
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(draft);

  async function saveExercise() {
    await api.post('/api/admin/exercises', draft);
    setDraft({ name: '', muscleGroup: '', equipment: '', techniqueNote: '', isHidden: false });
    await props.reload();
  }

  return (
    <section className="stack">
      <section className="panel">
        <h2>Новое упражнение</h2>
        <input placeholder="Название" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        <input
          placeholder="Группа мышц"
          value={draft.muscleGroup}
          onChange={(event) => setDraft({ ...draft, muscleGroup: event.target.value })}
        />
        <input
          placeholder="Оборудование"
          value={draft.equipment}
          onChange={(event) => setDraft({ ...draft, equipment: event.target.value })}
        />
        <textarea
          placeholder="Заметка по технике"
          value={draft.techniqueNote}
          onChange={(event) => setDraft({ ...draft, techniqueNote: event.target.value })}
        />
        <button onClick={saveExercise}>
          <Plus size={18} /> Создать
        </button>
      </section>

      {props.exercises.map((exercise) => (
        <article className={exercise.isHidden ? 'card dimmed' : 'card'} key={exercise.id}>
          {editingId === exercise.id ? (
            <div className="edit-grid">
              <input value={editDraft.name} onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })} />
              <input
                value={editDraft.muscleGroup}
                onChange={(event) => setEditDraft({ ...editDraft, muscleGroup: event.target.value })}
              />
              <input
                value={editDraft.equipment}
                onChange={(event) => setEditDraft({ ...editDraft, equipment: event.target.value })}
              />
              <textarea
                value={editDraft.techniqueNote}
                onChange={(event) => setEditDraft({ ...editDraft, techniqueNote: event.target.value })}
              />
              <div className="actions">
                <button
                  onClick={async () => {
                    await api.patch(`/api/admin/exercises/${exercise.id}`, editDraft);
                    setEditingId(null);
                    await props.reload();
                  }}
                >
                  <Save size={18} /> Сохранить
                </button>
                <button className="secondary" onClick={() => setEditingId(null)}>
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="card-header">
              <div>
                <h3>{exercise.name}</h3>
                <span className="muted">
                  {exercise.muscleGroup} · {exercise.equipment}
                </span>
              </div>
              <div className="actions compact-actions">
                <button
                  className="secondary"
                  onClick={() => {
                    setEditingId(exercise.id);
                    setEditDraft({
                      name: exercise.name,
                      muscleGroup: exercise.muscleGroup,
                      equipment: exercise.equipment,
                      techniqueNote: exercise.techniqueNote ?? '',
                      isHidden: exercise.isHidden
                    });
                  }}
                >
                  Редактировать
                </button>
                <button
                  className="secondary"
                  onClick={async () => {
                    await api.patch(`/api/admin/exercises/${exercise.id}`, { isHidden: !exercise.isHidden });
                    await props.reload();
                  }}
                >
                  {exercise.isHidden ? 'Показать' : 'Скрыть'}
                </button>
              </div>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
