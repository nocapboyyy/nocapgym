# Select Focus Tabbar Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Не скрывать нижнее меню при фокусе на нативном `select`, сохранив скрытие для элементов, открывающих экранную клавиатуру.

**Architecture:** Выделить классификацию элемента по типу в чистую экспортируемую функцию и использовать её внутри существующего DOM-обработчика фокуса. Viewport-детектор, CSS и остальные панели не изменяются.

**Tech Stack:** React, TypeScript, Vitest

---

### Task 1: Исправить классификацию активного элемента

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.ts`

- [ ] **Step 1: Написать падающий unit-тест**

Импортировать `isKeyboardEditingElement` из `./App` и добавить:

```ts
describe('isKeyboardEditingElement', () => {
  it('excludes native selects while keeping keyboard editors', () => {
    expect(isKeyboardEditingElement({ tagName: 'INPUT', isContentEditable: false })).toBe(true);
    expect(isKeyboardEditingElement({ tagName: 'TEXTAREA', isContentEditable: false })).toBe(true);
    expect(isKeyboardEditingElement({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isKeyboardEditingElement({ tagName: 'SELECT', isContentEditable: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Подтвердить RED**

Run: `npm test -w apps/web -- src/App.test.ts`

Expected: FAIL, потому что `isKeyboardEditingElement` ещё не экспортируется.

- [ ] **Step 3: Реализовать минимальную функцию и подключить её**

Добавить в `apps/web/src/App.tsx`:

```ts
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
```

Это заменяет selector с `select`; других изменений в focus effect не делать.

- [ ] **Step 4: Подтвердить GREEN и отсутствие регрессий**

Run: `npm test -w apps/web -- src/App.test.ts`

Expected: все тесты файла PASS.

Run: `npm run typecheck -w apps/web`

Expected: exit code 0.

- [ ] **Step 5: Выполнить полную frontend-проверку и commit**

Run: `npm test -w apps/web`

Expected: все frontend-тесты PASS.

Run: `git diff --check`

Expected: exit code 0 без сообщений.

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.ts docs/superpowers/plans/2026-06-18-select-focus-tabbar-fix.md
git commit -m "fix: keep tabbar visible for selects"
```

### Task 2: Проверить пользовательский сценарий

**Files:**
- No file changes expected.

- [ ] **Step 1: Проверить desktop/mobile browser behavior**

Открыть вкладку «История», открыть и закрыть список упражнений блока «Прогресс» и подтвердить, что нижнее меню остаётся видимым. Затем сфокусировать обычный текстовый `input` и подтвердить, что прежнее скрытие нижнего меню сохраняется.

- [ ] **Step 2: Зафиксировать ограничение проверки**

В handoff указать, что нативный picker требует дополнительной проверки в Telegram iOS WebView на реальном устройстве.
