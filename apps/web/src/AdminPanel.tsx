import { useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { api } from './api';
import type { Exercise, MuscleGroup } from './types';

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

export function AdminPanel(props: { exercises: Exercise[]; reload: (changed: Exercise, previous?: Exercise) => void }) {
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
    const changed = await api.post<Exercise>('/api/admin/exercises', draft);
    setDraft(emptyDraft);
    props.reload(changed);
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
                    const changed = await api.patch<Exercise>(`/api/admin/exercises/${exercise.id}`, editDraft);
                    setEditingId(null);
                    props.reload(changed, exercise);
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
                    const changed = await api.patch<Exercise>(`/api/admin/exercises/${exercise.id}`, { isHidden: !exercise.isHidden });
                    props.reload(changed, exercise);
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
