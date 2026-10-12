import { useEffect, useRef } from 'react';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export type ModalKeyboardAction = 'close' | 'first' | 'last' | null;

export function getModalKeyboardAction(input: {
  key: string;
  shiftKey: boolean;
  activeIndex: number;
  focusableCount: number;
}): ModalKeyboardAction {
  if (input.key === 'Escape') return 'close';
  if (input.key !== 'Tab' || input.focusableCount === 0) return null;
  if (input.activeIndex === -1) return input.shiftKey ? 'last' : 'first';
  if (input.shiftKey && input.activeIndex === 0) return 'last';
  if (!input.shiftKey && input.activeIndex === input.focusableCount - 1) return 'first';
  return null;
}

export function useModalFocus<T extends HTMLElement>(
  isOpen: boolean,
  onClose: () => void,
  focusKey: string = 'default'
) {
  const containerRef = useRef<T | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    function handleKeyDown(event: KeyboardEvent) {
      const container = containerRef.current;
      if (!container) return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
      const action = getModalKeyboardAction({
        key: event.key,
        shiftKey: event.shiftKey,
        activeIndex: focusable.indexOf(document.activeElement as HTMLElement),
        focusableCount: focusable.length
      });

      if (action === 'close') {
        event.preventDefault();
        onCloseRef.current();
      } else if (action === 'first' || action === 'last') {
        event.preventDefault();
        focusable[action === 'first' ? 0 : focusable.length - 1]?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) previousFocus.focus();
      previousFocusRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      const firstFocusable = containerRef.current?.querySelector<HTMLElement>(focusableSelector);
      firstFocusable?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusKey, isOpen]);

  return containerRef;
}
