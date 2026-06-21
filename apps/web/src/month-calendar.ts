import type { WorkoutSession } from './types';
import { toLocalDateKey } from './week-calendar';

type HistoryItem = Pick<WorkoutSession, 'id' | 'startedAt' | 'status'>;

export type MonthCalendarDay = {
  date: Date;
  dateKey: string;
  dayNumber: number;
  weekdayLabel: string;
  accessibleLabel: string;
  isToday: boolean;
  isOutsideDisplayedMonth: boolean;
  hasWorkout: boolean;
};

type SwipeCoordinates = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
const SWIPE_THRESHOLD_PX = 44;
const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long' });
const accessibleDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

export function formatMonthYear(date: Date): string {
  const month = monthFormatter.format(date);
  const capitalizedMonth = month.charAt(0).toLocaleUpperCase('ru-RU') + month.slice(1);

  return `${capitalizedMonth} ${date.getFullYear()}`;
}

export function getAdjacentMonth(date: Date, delta: -1 | 1): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function getHorizontalSwipeDelta(coordinates: SwipeCoordinates): -1 | 0 | 1 {
  const horizontalDistance = coordinates.endX - coordinates.startX;
  const verticalDistance = coordinates.endY - coordinates.startY;

  if (
    Math.abs(horizontalDistance) < SWIPE_THRESHOLD_PX ||
    Math.abs(horizontalDistance) <= Math.abs(verticalDistance)
  ) {
    return 0;
  }

  return horizontalDistance < 0 ? 1 : -1;
}

export function buildMonthCalendar(
  displayedMonth: Date,
  todayInput: Date,
  history: HistoryItem[]
): MonthCalendarDay[] {
  const monthStart = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), 1);
  const today = new Date(todayInput.getFullYear(), todayInput.getMonth(), todayInput.getDate());
  const mondayOffset = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    monthStart.getDate() - mondayOffset
  );
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

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const dateKey = toLocalDateKey(date);
    const hasWorkout = completedWorkoutDates.has(dateKey);
    const accessibleDate = accessibleDateFormatter.format(date);

    return {
      date,
      dateKey,
      dayNumber: date.getDate(),
      weekdayLabel: WEEKDAY_LABELS[index % WEEKDAY_LABELS.length],
      accessibleLabel: hasWorkout ? `${accessibleDate}, есть тренировка` : accessibleDate,
      isToday: date.getTime() === today.getTime(),
      isOutsideDisplayedMonth: date.getMonth() !== monthStart.getMonth(),
      hasWorkout
    };
  });
}
