import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, CalendarDays, Dumbbell, History, UserRound } from 'lucide-react';
import { api, getUserFacingApiError, telegramAuthExpiredEvent } from './api';
import { getAuthHeaders, initTelegramApp } from './telegram';
import { recordCompletion, recordDeletion, recordTemplate } from './workout-cache';
import { readStartup, readActiveSession } from './startup';
import { ScreenData, ScreenDataContext, ReadStatus, useScreenData } from './screen-data';
import { WeekCalendar } from './WeekCalendar';
import { CyclePanel, GenderOnboarding, ProfileMenu } from './UserPersonalization';
import { getSafeViewAfterGenderChange, getTabTitle, getVisibleUserTabs } from './navigation';
import type { AppView, UserTab } from './navigation';
import type { Exercise, Gender, HistoryCard, HistoryPage, User, WorkoutSession } from './types';
import { SessionDraft } from './session-draft';
import { completeWorkoutRequest, getSessionCompletionValidationError, GymScreen } from './GymScreen';
import { PlansScreen } from './PlansScreen';
import { HistoryPanel } from './HistoryPanel';
import { AdminPanel } from './AdminPanel';

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
const telegramAuthExpiredError = 'Сессия Telegram устарела. Закройте и снова откройте приложение.';

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

function accountKey() {
  const headers = getAuthHeaders();
  return headers['x-telegram-init-data'] || headers['x-dev-telegram-id'];
}

export function App() {
  const [account, setAccount] = useState(accountKey);
  useEffect(() => {
    const syncAccount = () => setAccount(accountKey());
    window.addEventListener('storage', syncAccount);
    window.addEventListener('focus', syncAccount);
    document.addEventListener('visibilitychange', syncAccount);
    return () => {
      window.removeEventListener('storage', syncAccount);
      window.removeEventListener('focus', syncAccount);
      document.removeEventListener('visibilitychange', syncAccount);
    };
  }, []);
  return <AccountApp key={account} />;
}

function AccountApp() {
  const [store] = useState(() => new ScreenData());
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    function expire() {
      setExpired(true);
      store.invalidate('');
    }
    window.addEventListener(telegramAuthExpiredEvent, expire);
    return () => window.removeEventListener(telegramAuthExpiredEvent, expire);
  }, [store]);
  if (expired) return <main className="app-shell centered"><p role="alert">{telegramAuthExpiredError}</p></main>;
  return <ScreenDataContext.Provider value={store}><WorkoutApp store={store} /></ScreenDataContext.Provider>;
}

function WorkoutApp({ store }: { store: ScreenData }) {
  const [view, setView] = useState<AppView>('templates');
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [draft] = useState(() => new SessionDraft());
  const [changedExercise, setChangedExercise] = useState<Exercise | null>(null);
  const [selectedProgressExerciseId, setSelectedProgressExerciseId] = useState('');

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [editableFocused, setEditableFocused] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [savingGender, setSavingGender] = useState(false);
  const [genderError, setGenderError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageCursors, setPageCursors] = useState<string[]>([]);
  const ready = !loading && !loadError && Boolean(user?.gender);
  const adminCatalog = useScreenData<Exercise[]>(ready && isAdmin && view === 'admin' ? '/api/admin/exercises' : undefined);
  const completingSession = useRef<string | null>(null);
  const pendingStartup = useRef<ReturnType<typeof readStartup> | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const previousUserTabRef = useRef<UserTab>('templates');

  useEffect(() => {
    initTelegramApp();
    void loadInitialData();
    // The Telegram bootstrap must run once for each mounted WebView.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function restoreSession(session: WorkoutSession | null) {
    draft.restore(session);
    setView(session ? 'session' : 'templates');
  }

  async function loadInitialData() {
    if (pendingStartup.current) return;
    setLoading(true);
    setLoadError(null);
    try {
      pendingStartup.current = readStartup();
      const initial = await pendingStartup.current;
      setUser(initial.user);
      setIsAdmin(initial.isAdmin);
      restoreSession(initial.session);
    } catch {
      setLoadError(initialLoadError);
    } finally {
      pendingStartup.current = null;
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
          restoreSession(await readActiveSession());
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

  function resetHistoryPages() {
    setPageCursors([]);
    store.invalidate('/api/history/page');
  }

  async function startSession(templateId: string) {
    const session = await api.post<WorkoutSession>('/api/sessions/start', { templateId });
    draft.restore(session);
    setView('session');
  }

  async function completeSession(applyToTemplate: boolean) {
    const activeSession = draft.read();
    if (!activeSession || completingSession.current === activeSession.id) return;
    const validationError = getSessionCompletionValidationError(activeSession);
    if (validationError) return setMessage(validationError);
    completingSession.current = activeSession.id;
    try {
      const completed = await completeWorkoutRequest({
        session: activeSession,
        applyToTemplate,
        post: (path, body) => api.post<WorkoutSession>(path, body)
      });
      recordCompletion(store, completed);
      if (completed.updatedTemplate) recordTemplate(store, completed.updatedTemplate.id, completed.updatedTemplate);
      else if (applyToTemplate) store.invalidate('/api/templates');
    } catch (error) {
      return setMessage(getUserFacingApiError(error, 'Не удалось завершить тренировку. Попробуйте ещё раз.'));
    } finally {
      if (completingSession.current === activeSession.id) completingSession.current = null;
    }
    if (draft.read()?.id !== activeSession.id) return;
    draft.restore(null);
    setView('history');
    setMessage(applyToTemplate ? 'Тренировка завершена, шаблон обновлён' : 'Тренировка завершена');
  }

  async function _exportBackup() {
    const payload = await api.get<unknown>('/api/export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `gym-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function _importBackup(file: File) {
    const payload = JSON.parse(await file.text());
    await api.post('/api/import', payload);
    draft.restore(null);
    setSelectedProgressExerciseId('');
    resetHistoryPages();
    store.invalidate('/api/templates');
    store.invalidate('/api/history/calendar');
    store.invalidate('/api/progress/');
    setMessage('Данные импортированы');
    setLoading(true);
    try {
      draft.restore(await readActiveSession());
    } catch {
      setLoadError(initialLoadError);
    } finally {
      setLoading(false);
    }
  }

  async function deleteHistorySession(card: HistoryCard) {
    if (!window.confirm('Удалить тренировку из истории?')) return;
    try {
      await api.delete(`/api/sessions/${card.id}`);
    } catch (error) {
      setMessage(getUserFacingApiError(error, 'Не удалось удалить тренировку.'));
      return;
    }
    recordDeletion(store, card);
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

      {getPlansCalendarVisible(view) && <WeekCalendar />}

      <PlansScreen visible={view === 'templates'} store={store} setMessage={setMessage}
        changedExercise={changedExercise} onStart={startSession} />
      {view === 'session' && <GymScreen draft={draft} onStart={startSession}
        onComplete={completeSession} onOpenTemplates={() => setView('templates')} />}

      {view === 'history' && (
        <HistoryPanel
          cursors={pageCursors}
          onNext={cursor => setPageCursors(current => current.includes(cursor) ? current : [...current, cursor])}
          selectedExerciseId={selectedProgressExerciseId}
          onSelectExercise={setSelectedProgressExerciseId}
          onDeleteSession={deleteHistorySession}
        />
      )}

      {view === 'cycle' && user.gender === 'female' && <CyclePanel />}

      {view === 'admin' && isAdmin && <ReadStatus resource={adminCatalog} label="каталог упражнений" />}
      {view === 'admin' && isAdmin && adminCatalog.data && (
        <AdminPanel
          exercises={adminCatalog.data}
          reload={(changed, previous) => {
            store.invalidate('/api/admin/exercises');
            store.invalidate('/api/exercises');
            if (previous) {
              store.invalidate('/api/templates/');
              draft.updateExercise(changed);
              setChangedExercise(changed);
              if (changed.name !== previous.name) {
                for (const path of store.paths('/api/history/page')) {
                  store.update<HistoryPage>(path, page => !page.items.some(card => card.exerciseIds.includes(changed.id)) ? page : ({
                    ...page, items: page.items.map(card => ({
                      ...card, exerciseNames: card.exerciseNames.map((name, index) =>
                        card.exerciseIds[index] === changed.id ? changed.name : name)
                    }))
                  }));
                }
                store.retry('/api/progress/exercises');
              }
            }
          }}
        />
      )}
    </main>
  );
}
