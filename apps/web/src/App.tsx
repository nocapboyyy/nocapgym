import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  Dumbbell,
  GripVertical,
  History,
  ListPlus,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
  UserRound,
  X
} from 'lucide-react';
import { api } from './api';
import { initTelegramApp, setTelegramVerticalSwipesEnabled } from './telegram';
import { MonthCalendar } from './MonthCalendar';
import { WeekCalendar } from './WeekCalendar';
import { CyclePanel, GenderOnboarding, ProfileMenu } from './UserPersonalization';
import {
  getSafeViewAfterGenderChange,
  getTabTitle,
  getVisibleUserTabs
} from './navigation';
import type { AppView, UserTab } from './navigation';
import type {
  Exercise,
  Gender,
  MuscleGroup,
  ProgressPoint,
  SessionExercise,
  SessionSet,
  TemplateExercise,
  TemplateSet,
  User,
  WorkoutSession,
  WorkoutTemplate
} from './types';

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

export function getPlansCalendarVisible(view: AppView) {
  return view === 'templates';
}

const userTabMetadata = {
  templates: { label: getTabTitle('templates'), icon: Dumbbell },
  session: { label: getTabTitle('session'), icon: Activity },
  history: { label: getTabTitle('history'), icon: History },
  cycle: { label: getTabTitle('cycle'), icon: CalendarDays }
} satisfies Record<UserTab, { label: string; icon: typeof Dumbbell }>;

const genderSaveError = 'Не удалось сохранить пол. Попробуйте ещё раз.';
const initialLoadError = 'Не удалось загрузить данные. Попробуйте ещё раз.';

export const MUSCLE_GROUP_OPTIONS: Array<{ value: MuscleGroup; label: string }> = [
  { value: 'neck', label: 'Шея' },
  { value: 'shoulders', label: 'Плечи' },
  { value: 'chest', label: 'Грудь' },
  { value: 'arms', label: 'Руки' },
  { value: 'abs', label: 'Пресс' },
  { value: 'back', label: 'Спина' },
  { value: 'glutes', label: 'Ягодицы' },
  { value: 'legs', label: 'Ноги' }
];

export function getMuscleGroupLabel(muscleGroup: MuscleGroup | null) {
  return MUSCLE_GROUP_OPTIONS.find((option) => option.value === muscleGroup)?.label ?? 'Группа не выбрана';
}

export function getPreviousUserTabAfterGenderChange(previousTab: UserTab, gender: Gender): UserTab {
  return previousTab === 'cycle' && gender === 'male' ? 'templates' : previousTab;
}

export function getAppStartupState(input: {
  loading: boolean;
  user: Pick<User, 'gender'> | null;
  loadError: string | null;
}): 'loading' | 'error' | 'onboarding' | 'ready' {
  if (input.loading) return 'loading';
  if (input.loadError || !input.user) return 'error';
  return input.user.gender === null ? 'onboarding' : 'ready';
}

export async function orchestrateGenderSave(input: {
  gender: Gender;
  shouldLoadWorkoutData: boolean;
  patchUser: (gender: Gender) => Promise<User>;
  commitUser: (user: User) => void;
  loadWorkoutData: () => Promise<void>;
}): Promise<'success' | 'profile-update-error' | 'data-load-error'> {
  let updatedUser: User;
  try {
    updatedUser = await input.patchUser(input.gender);
  } catch {
    return 'profile-update-error';
  }

  input.commitUser(updatedUser);
  if (!input.shouldLoadWorkoutData) return 'success';

  try {
    await input.loadWorkoutData();
    return 'success';
  } catch {
    return 'data-load-error';
  }
}

export function getHistorySessionPlanTitle(input: { template?: Pick<WorkoutTemplate, 'id' | 'name'> | null }) {
  return input.template?.name?.trim() || 'План не найден';
}

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

export function getSessionExerciseTitle(
  exercise: Pick<SessionExercise, 'exerciseId' | 'exercise'>,
  exercises: Exercise[]
) {
  return exercises.find((item) => item.id === exercise.exerciseId)?.name ?? exercise.exercise?.name ?? 'Упражнение';
}

export function getProgressExercises(history: WorkoutSession[]): Exercise[] {
  const exercisesById = new Map<string, Exercise>();

  for (const session of history) {
    if (session.status !== 'completed') continue;

    for (const sessionExercise of session.exercises) {
      if (
        sessionExercise.exercise &&
        sessionExercise.sets.some(
          (set) =>
            set.type === 'working' &&
            set.completed &&
            set.actualWeightKg !== null &&
            set.actualReps !== null
        )
      ) {
        exercisesById.set(sessionExercise.exerciseId, sessionExercise.exercise);
      }
    }
  }

  return [...exercisesById.values()].sort((left, right) => left.name.localeCompare(right.name, 'ru'));
}

export function isKeyboardEditingElement(input: { tagName: string; isContentEditable: boolean }) {
  return input.tagName === 'INPUT' || input.tagName === 'TEXTAREA' || input.isContentEditable;
}

function isEditableElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false;
  return isKeyboardEditingElement({
    tagName: element.tagName,
    isContentEditable: element.isContentEditable
  });
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

export function App() {
  const [view, setView] = useState<AppView>('templates');
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [savingGender, setSavingGender] = useState(false);
  const [genderError, setGenderError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const previousUserTabRef = useRef<UserTab>('templates');

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

  useEffect(() => {
    if (!profileMenuOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setProfileMenuOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileMenuOpen]);

  async function loadWorkoutData(admin: boolean) {
    const [exerciseList, templateList, historyList, adminExerciseList] = await Promise.all([
      api.get<Exercise[]>('/api/exercises'),
      api.get<WorkoutTemplate[]>('/api/templates'),
      api.get<WorkoutSession[]>('/api/history'),
      admin ? api.get<Exercise[]>('/api/admin/exercises') : Promise.resolve([])
    ]);

    setExercises(exerciseList);
    setTemplates(templateList);
    setHistory(historyList);
    setAdminExercises(adminExerciseList);
  }

  async function loadInitialData() {
    setLoading(true);
    setLoadError(null);
    try {
      const me = await api.get<{ user: User; isAdmin: boolean }>('/api/me');
      setUser(me.user);
      setIsAdmin(me.isAdmin);
      if (me.user.gender !== null) {
        await loadWorkoutData(me.isAdmin);
      }
    } catch {
      setLoadError(initialLoadError);
    } finally {
      setLoading(false);
    }
  }

  async function saveGender(gender: Gender) {
    const shouldLoadWorkoutData = user?.gender === null;
    setSavingGender(true);
    setGenderError(null);

    const result = await orchestrateGenderSave({
      gender,
      shouldLoadWorkoutData,
      patchUser: (nextGender) => api.patch<User>('/api/me', { gender: nextGender }),
      commitUser: (updatedUser) => {
        setUser(updatedUser);
        previousUserTabRef.current = getPreviousUserTabAfterGenderChange(
          previousUserTabRef.current,
          gender
        );
        setView((currentView) => getSafeViewAfterGenderChange(currentView, gender));
        setProfileMenuOpen(false);
      },
      loadWorkoutData: async () => {
        setLoading(true);
        try {
          await loadWorkoutData(isAdmin);
        } finally {
          setLoading(false);
        }
      }
    });

    if (result === 'profile-update-error') {
      setGenderError(genderSaveError);
    } else if (result === 'data-load-error') {
      setLoadError(initialLoadError);
    }
    setSavingGender(false);
  }

  function openAdmin() {
    if (!isAdmin) return;
    if (view !== 'admin') previousUserTabRef.current = view;
    setProfileMenuOpen(false);
    setView('admin');
  }

  function toggleAdminInterface() {
    if (!isAdmin) return;
    if (view === 'admin') {
      setProfileMenuOpen(false);
      setView(previousUserTabRef.current);
    } else {
      openAdmin();
    }
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
      exercises: templateDraft.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        order: exercise.order,
        sets: exercise.sets
      }))
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
    setView('session');
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
    setView('history');
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
    () => getVisibleUserTabs(user?.gender ?? null).map((id) => ({ id, ...userTabMetadata[id] })),
    [user?.gender]
  );
  const bottomControlsHidden = getBottomControlsHidden({ isKeyboardOpen: keyboardOpen, isEditableFocused: editableFocused });
  const startupState = getAppStartupState({ loading, user, loadError });

  function renderLoadError() {
    return (
      <main className="app-shell centered">
        <section className="panel empty" role="alert">
          <p>{loadError ?? initialLoadError}</p>
          <button type="button" onClick={() => void loadInitialData()}>
            Повторить
          </button>
        </section>
      </main>
    );
  }

  if (startupState === 'loading') {
    return <main className="app-shell centered">Загрузка...</main>;
  }

  if (startupState === 'error') {
    return renderLoadError();
  }

  if (startupState === 'onboarding') {
    return <GenderOnboarding saving={savingGender} error={genderError} onSelect={saveGender} />;
  }

  if (!user || user.gender === null) {
    return renderLoadError();
  }

  return (
    <main className={bottomControlsHidden ? 'app-shell bottom-controls-hidden' : 'app-shell'}>
      <header className="topbar">
        <div>
          <span className="eyebrow">NOCAPGYM</span>
          <h1>{getTabTitle(view)}</h1>
        </div>
        <div ref={profileMenuRef}>
          <button
            type="button"
            className="profile"
            aria-haspopup="dialog"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((open) => !open)}
          >
            <UserRound aria-hidden="true" />
            {user.firstName ?? user.username ?? 'Пользователь'}
          </button>
          {profileMenuOpen ? (
            <>
              <ProfileMenu
                gender={user.gender}
                isAdmin={isAdmin}
                adminActionLabel={view === 'admin' ? 'Клиент' : 'Админ'}
                saving={savingGender}
                onGenderChange={saveGender}
                onAdminAction={toggleAdminInterface}
              />
              {genderError ? <p className="form-error" role="alert">{genderError}</p> : null}
            </>
          ) : null}
        </div>
      </header>

      {message && (
        <button className="toast" onClick={() => setMessage('')}>
          {message}
        </button>
      )}

      {view !== 'admin' ? (
        <nav className="tabbar" aria-label="Основная навигация">
          {tabs.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'active' : ''}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => setView(item.id)}
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      ) : null}

      {getPlansCalendarVisible(view) && <WeekCalendar history={history} />}

      {view === 'templates' && (
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
                exercise: exercise.exercise,
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

      {view === 'session' && (
        <SessionPanel
          session={activeSession}
          exercises={exercises}
          setSession={setActiveSession}
          onComplete={completeSession}
        />
      )}

      {view === 'history' && (
        <HistoryPanel
          history={history}
          progress={progress}
          selectedExerciseId={selectedProgressExerciseId}
          onSelectExercise={loadProgress}
          onDeleteSession={deleteHistorySession}
        />
      )}

      {view === 'cycle' && user.gender === 'female' && <CyclePanel />}

      {view === 'admin' && isAdmin && (
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
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);
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
    setEditingExerciseIndex(null);
    setDialogStep('form');
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setDialogStep('form');
    setSelectedExercise(null);
    setExerciseDraft(null);
    setEditingExerciseIndex(null);
    props.onCancelEdit();
  }

  function openExerciseDetail(exercise: Exercise) {
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
    const exercise = props.draft.exercises[exerciseIndex];
    const catalogExercise = props.exercises.find((item) => item.id === exercise.exerciseId);
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
      exercises: getSavedTemplateExercises(props.draft.exercises, exerciseDraft, editingExerciseIndex)
    });
    setSelectedExercise(null);
    setExerciseDraft(null);
    setEditingExerciseIndex(null);
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
    if (!props.draft.name?.trim() || props.draft.exercises.length === 0) {
      await props.onSave();
      return;
    }
    await props.onSave();
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
                      const catalogExercise = props.exercises.find((item) => item.id === exercise.exerciseId);
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

function SessionPanel(props: {
  session: WorkoutSession | null;
  exercises: Exercise[];
  setSession: (session: WorkoutSession | null) => void;
  onComplete: (applyToTemplate: boolean) => void;
}) {
  const [expandedExercises, setExpandedExercises] = useState(() =>
    getInitialExerciseDisclosureState(props.session?.exercises.length ?? 0)
  );

  useEffect(() => {
    setExpandedExercises(getInitialExerciseDisclosureState(props.session?.exercises.length ?? 0));
  }, [props.session?.id]);

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
                        exercises: props.session!.exercises.filter((_, index) => index !== exerciseIndex)
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

export function HistoryPanel(props: {
  history: WorkoutSession[];
  progress: ProgressPoint[];
  selectedExerciseId: string;
  onSelectExercise: (id: string) => void;
  onDeleteSession: (id: string) => void;
}) {
  const progressExercises = useMemo(() => getProgressExercises(props.history), [props.history]);

  return (
    <section className="stack">
      <MonthCalendar history={props.history} />

      <section className="panel">
        <h2>Прогресс</h2>
        <select value={props.selectedExerciseId} onChange={(event) => props.onSelectExercise(event.target.value)}>
          <option value="">Выберите упражнение</option>
          {progressExercises.map((exercise) => (
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
            <div className="card-header history-card-header">
              <h3>{session.completedAt ? new Date(session.completedAt).toLocaleDateString('ru-RU') : 'Тренировка'}</h3>
              <div className="history-card-actions">
                <span className="history-plan-name">{getHistorySessionPlanTitle(session)}</span>
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
  type ExerciseDraft = {
    name: string;
    muscleGroup: MuscleGroup | '';
    equipment: string;
    techniqueNote: string;
    isHidden: boolean;
  };

  const emptyDraft: ExerciseDraft = {
    name: '',
    muscleGroup: '',
    equipment: '',
    techniqueNote: '',
    isHidden: false
  };

  const [draft, setDraft] = useState<ExerciseDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(draft);
  const canCreateExercise = draft.name.trim().length > 0 && draft.muscleGroup !== '' && draft.equipment.trim().length > 0;
  const canSaveExercise = editDraft.name.trim().length > 0 && editDraft.muscleGroup !== '' && editDraft.equipment.trim().length > 0;

  async function saveExercise() {
    await api.post('/api/admin/exercises', draft);
    setDraft(emptyDraft);
    await props.reload();
  }

  return (
    <section className="stack">
      <section className="panel">
        <h2>Новое упражнение</h2>
        <input placeholder="Название" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        <select
          aria-label="Группа мышц"
          value={draft.muscleGroup}
          onChange={(event) => setDraft({ ...draft, muscleGroup: event.target.value as MuscleGroup | '' })}
        >
          <option value="">Группа мышц</option>
          {MUSCLE_GROUP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
        <button disabled={!canCreateExercise} onClick={saveExercise}>
          <Plus size={18} /> Создать
        </button>
      </section>

      {props.exercises.map((exercise) => (
        <article className={exercise.isHidden ? 'card dimmed' : 'card'} key={exercise.id}>
          {editingId === exercise.id ? (
            <div className="edit-grid">
              <input value={editDraft.name} onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })} />
              <select
                aria-label="Группа мышц"
                value={editDraft.muscleGroup}
                onChange={(event) => setEditDraft({ ...editDraft, muscleGroup: event.target.value as MuscleGroup | '' })}
              >
                <option value="">Группа мышц</option>
                {MUSCLE_GROUP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
                  disabled={!canSaveExercise}
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
                  {getMuscleGroupLabel(exercise.muscleGroup)} · {exercise.equipment}
                </span>
              </div>
              <div className="actions compact-actions">
                <button
                  className="secondary"
                  onClick={() => {
                    setEditingId(exercise.id);
                    setEditDraft({
                      name: exercise.name,
                      muscleGroup: exercise.muscleGroup ?? '',
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
