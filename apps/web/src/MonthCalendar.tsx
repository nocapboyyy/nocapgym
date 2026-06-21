import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { WorkoutSession } from './types';
import {
  buildMonthCalendar,
  formatMonthYear,
  getAdjacentMonth,
  getHorizontalSwipeDelta
} from './month-calendar';
import { startLiveDayRefresh } from './week-calendar';

type MonthCalendarProps = {
  history: WorkoutSession[];
  now?: Date;
};

type PointerOrigin = {
  x: number;
  y: number;
};

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

function isSameMonth(first: Date, second: Date): boolean {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth();
}

export function getDisplayedMonthAfterCurrentChange(
  displayedMonth: Date,
  previousCurrent: Date,
  nextCurrent: Date
): Date {
  if (!isSameMonth(displayedMonth, previousCurrent)) {
    return displayedMonth;
  }

  return new Date(nextCurrent.getFullYear(), nextCurrent.getMonth(), 1);
}

export function getDisplayedMonthAfterPointerUp(
  displayedMonth: Date,
  origin: PointerOrigin | null,
  end: PointerOrigin
): Date {
  if (origin === null) {
    return displayedMonth;
  }

  const delta = getHorizontalSwipeDelta({
    startX: origin.x,
    startY: origin.y,
    endX: end.x,
    endY: end.y
  });

  return delta === 0 ? displayedMonth : getAdjacentMonth(displayedMonth, delta);
}

export function MonthCalendar({ history, now }: MonthCalendarProps) {
  const [liveNow, setLiveNow] = useState(() => new Date());
  const current = now ?? liveNow;
  const [displayedMonth, setDisplayedMonth] = useState(
    () => new Date(current.getFullYear(), current.getMonth(), 1)
  );
  const previousCurrent = useRef(current);
  const pointerOrigin = useRef<PointerOrigin | null>(null);

  useEffect(() => {
    if (now !== undefined || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    return startLiveDayRefresh(setLiveNow, {
      now: () => new Date(),
      setTimeout: (callback, delay) => window.setTimeout(callback, delay),
      clearTimeout: (timeoutId) => window.clearTimeout(timeoutId),
      subscribeFocus: (listener) => window.addEventListener('focus', listener),
      unsubscribeFocus: (listener) => window.removeEventListener('focus', listener),
      subscribeVisibility: (listener) => document.addEventListener('visibilitychange', listener),
      unsubscribeVisibility: (listener) => document.removeEventListener('visibilitychange', listener),
      isVisible: () => document.visibilityState === 'visible'
    });
  }, [now]);

  const currentYear = current.getFullYear();
  const currentMonth = current.getMonth();

  useEffect(() => {
    const priorCurrent = previousCurrent.current;
    const nextCurrent = new Date(currentYear, currentMonth, 1);

    setDisplayedMonth((month) =>
      getDisplayedMonthAfterCurrentChange(month, priorCurrent, nextCurrent)
    );
    previousCurrent.current = nextCurrent;
  }, [currentMonth, currentYear]);

  const changeMonth = (delta: -1 | 1) => {
    setDisplayedMonth((month) => getAdjacentMonth(month, delta));
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    pointerOrigin.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const origin = pointerOrigin.current;
    pointerOrigin.current = null;

    setDisplayedMonth((month) =>
      getDisplayedMonthAfterPointerUp(month, origin, { x: event.clientX, y: event.clientY })
    );
  };

  const label = formatMonthYear(displayedMonth);
  const days = buildMonthCalendar(displayedMonth, current, history);

  return (
    <section
      className="month-calendar panel"
      aria-label={`Календарь тренировок за ${label}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pointerOrigin.current = null;
      }}
    >
      <header className="month-calendar-header">
        <button
          type="button"
          className="month-calendar-navigation"
          aria-label="Предыдущий месяц"
          onClick={() => changeMonth(-1)}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <h2>{label}</h2>
        <button
          type="button"
          className="month-calendar-navigation"
          aria-label="Следующий месяц"
          onClick={() => changeMonth(1)}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </header>
      <div className="month-calendar-weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div className="month-calendar-days" role="list">
        {days.map((day) => {
          const className = [
            'month-calendar-day',
            day.isOutsideDisplayedMonth && 'outside-month',
            day.isToday && 'today'
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={day.dateKey} className={className} role="listitem" aria-label={day.accessibleLabel}>
              <time dateTime={day.dateKey}>{day.dayNumber}</time>
              {day.hasWorkout ? (
                <span className="month-calendar-workout" aria-hidden="true" />
              ) : (
                <span className="month-calendar-workout-placeholder" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
