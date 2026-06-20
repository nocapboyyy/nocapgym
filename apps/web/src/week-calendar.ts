import type { WorkoutSession } from './types';

type HistoryItem = Pick<WorkoutSession, 'id' | 'startedAt' | 'status'>;

export type WeekCalendarDay = {
  date: Date;
  dateKey: string;
  dayNumber: number;
  weekdayLabel: string;
  accessibleLabel: string;
  isToday: boolean;
  isOutsideCurrentMonth: boolean;
  hasWorkout: boolean;
};

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long' });
const accessibleDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long'
});

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatCurrentMonth(now: Date): string {
  const month = monthFormatter.format(now);

  return month.charAt(0).toLocaleUpperCase('ru-RU') + month.slice(1);
}

export function buildCurrentWeek(now: Date, history: HistoryItem[]): WeekCalendarDay[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
  const completedWorkoutDates = new Set<string>();

  for (const session of history) {
    if (session.status !== 'completed') {
      continue;
    }

    const startedAt = new Date(session.startedAt);
    if (!Number.isNaN(startedAt.getTime())) {
      completedWorkoutDates.add(toLocalDateKey(startedAt));
    }
  }

  return WEEKDAY_LABELS.map((weekdayLabel, index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    const dateKey = toLocalDateKey(date);

    return {
      date,
      dateKey,
      dayNumber: date.getDate(),
      weekdayLabel,
      accessibleLabel: accessibleDateFormatter.format(date),
      isToday: date.getTime() === today.getTime(),
      isOutsideCurrentMonth: date.getMonth() !== today.getMonth(),
      hasWorkout: completedWorkoutDates.has(dateKey)
    };
  });
}
