
export function getExerciseCountLabel(count: number) {
  const normalized = Math.abs(count);
  const lastTwoDigits = normalized % 100;
  const lastDigit = normalized % 10;
  const form = lastTwoDigits >= 11 && lastTwoDigits <= 14
    ? 'упражнений'
    : lastDigit === 1
      ? 'упражнение'
      : lastDigit >= 2 && lastDigit <= 4
        ? 'упражнения'
        : 'упражнений';

  return `${count} ${form}`;
}

export function numberInputValue(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
}

export function parseOptionalNumberInput(value: string) {
  return value.trim() === '' ? null : Number(value);
}
