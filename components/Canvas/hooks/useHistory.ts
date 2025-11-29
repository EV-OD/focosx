
import { useState, useCallback } from 'react';
import { FrameData, Stroke } from '../../../types';

export const useHistory = (initialFrames: FrameData[], initialStrokes: Stroke[]) => {
  const [history, setHistory] = useState<Array<{frames: FrameData[], globalStrokes: Stroke[]}>>([
      { frames: initialFrames, globalStrokes: initialStrokes }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const recordHistory = useCallback((framesSnapshot: FrameData[], strokesSnapshot: Stroke[]) => {
      setHistory(prev => {
          const upToCurrent = prev.slice(0, historyIndex + 1);
          if (upToCurrent.length > 50) upToCurrent.shift();
          return [...upToCurrent, { frames: framesSnapshot, globalStrokes: strokesSnapshot }];
      });
      setHistoryIndex(prev => Math.min(prev + 1, 50));
  }, [historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return {
    history,
    historyIndex,
    setHistoryIndex,
    setHistory,
    recordHistory,
    canUndo,
    canRedo
  };
};
