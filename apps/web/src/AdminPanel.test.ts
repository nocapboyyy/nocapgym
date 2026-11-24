import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUP_OPTIONS, getMuscleGroupLabel } from './AdminPanel';

describe('exercise muscle groups', () => {
  it('exposes the supported muscle groups with Russian labels', () => {
    expect(MUSCLE_GROUP_OPTIONS).toEqual([
      { value: 'neck', label: 'Шея' },
      { value: 'shoulders', label: 'Плечи' },
      { value: 'chest', label: 'Грудь' },
      { value: 'arms', label: 'Руки' },
      { value: 'abs', label: 'Пресс' },
      { value: 'back', label: 'Спина' },
      { value: 'glutes', label: 'Ягодицы' },
      { value: 'legs', label: 'Ноги' }
    ]);
  });

  it('shows a fallback label when an existing exercise has no group yet', () => {
    expect(getMuscleGroupLabel(null)).toBe('Группа не выбрана');
  });
});
