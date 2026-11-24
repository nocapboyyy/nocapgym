export function calendarRange(date: Date, grid: 'week' | 'month') {
  const start = new Date(date.getFullYear(), date.getMonth(), grid === 'month' ? 1 : date.getDate());
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(start);
  end.setDate(end.getDate() + (grid === 'month' ? 42 : 7));
  return { start, end };
}

export function calendarPath(date: Date, grid: 'week' | 'month') {
  const { start, end } = calendarRange(date, grid);
  return '/api/history/calendar?' + new URLSearchParams({ from: start.toISOString(), to: end.toISOString() });
}
