
import { useEffect, useCallback } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

/**
 * Hook para gestionar atajos de teclado globales
 * Soporta combinaciones con Ctrl, Shift, Alt, Meta (Cmd en Mac)
 */
export const useKeyboardShortcuts = (shortcuts: ShortcutConfig[]) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignorar si el usuario está escribiendo en un input
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      return;
    }

    for (const shortcut of shortcuts) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

/**
 * Lista de atajos disponibles para mostrar en UI
 */
export const getShortcutsList = (shortcuts: ShortcutConfig[]): string[] => {
  return shortcuts.map(s => {
    const keys: string[] = [];
    if (s.ctrl) keys.push('Ctrl');
    if (s.shift) keys.push('Shift');
    if (s.alt) keys.push('Alt');
    if (s.meta) keys.push('⌘');
    keys.push(s.key.toUpperCase());
    return `${keys.join('+')} - ${s.description}`;
  });
};

export default useKeyboardShortcuts;
