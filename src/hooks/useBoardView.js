import { useCallback, useState } from 'react';

export const BOARD_VIEW_KEY = 'tf-board-view';
export const BOARD_VIEWS = ['board', 'map'];

function readStored() {
  try {
    const v = localStorage.getItem(BOARD_VIEW_KEY);
    return BOARD_VIEWS.includes(v) ? v : 'board';
  } catch {
    return 'board';
  }
}

/**
 * Task board view ("board" columns or "map" diagram), remembered per browser.
 * @returns {['board'|'map', (view: 'board'|'map') => void]}
 */
export function useBoardView() {
  const [view, setViewState] = useState(readStored);
  const setView = useCallback((next) => {
    const value = BOARD_VIEWS.includes(next) ? next : 'board';
    setViewState(value);
    try {
      localStorage.setItem(BOARD_VIEW_KEY, value);
    } catch {
      /* storage unavailable: the choice lasts for this page only */
    }
  }, []);
  return [view, setView];
}
