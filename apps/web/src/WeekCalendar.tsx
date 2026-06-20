import { Dumbbell } from 'lucide-react';
import type { WorkoutSession } from './types';
import { buildCurrentWeek, formatCurrentMonth } from './week-calendar';

type WeekCalendarProps = {
  history: WorkoutSession[];
  now?: Date;
};

export function WeekCalendar({ history, now = new Date() }: WeekCalendarProps) {
  const days = buildCurrentWeek(now, history);

  return (
    <section className="week-calendar" aria-label="Текущая неделя">
      <h2>{formatCurrentMonth(now)}</h2>
      <div className="week-calendar-days" role="list">
        {days.map((day) => {
          const className = [
            'week-calendar-day',
            day.isOutsideCurrentMonth && 'outside-month',
            day.isToday && 'today'
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={day.dateKey} className={className} role="listitem" aria-label={day.accessibleLabel}>
              <time dateTime={day.dateKey}>{day.dayNumber}</time>
              <span className="week-calendar-weekday">{day.weekdayLabel}</span>
              {day.hasWorkout ? (
                <span
                  className="week-calendar-workout"
                  role="img"
                  aria-label={`Тренировка: ${day.accessibleLabel}`}
                >
                  <Dumbbell size={14} strokeWidth={2.2} aria-hidden="true" />
                </span>
              ) : (
                <span className="week-calendar-workout-placeholder" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
