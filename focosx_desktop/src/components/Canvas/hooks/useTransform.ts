
import React, { useState, useCallback, RefObject } from 'react';
import { InteractionMode } from '../../../types';

export const useTransform = (containerRef: RefObject<HTMLDivElement | null>) => {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });

  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = screenX - rect.left;
    const relativeY = screenY - rect.top;

    return {
      x: (relativeX - transform.x) / transform.k,
      y: (relativeY - transform.y) / transform.k
    };
  }, [transform]);

  const handleWheel = useCallback((e: React.WheelEvent, mode: InteractionMode) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      const newScale = Math.min(Math.max(0.1, transform.k + delta), 5);
      
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = (mouseX - transform.x) / transform.k;
      const worldY = (mouseY - transform.y) / transform.k;

      const newX = mouseX - worldX * newScale;
      const newY = mouseY - worldY * newScale;

      setTransform({ x: newX, y: newY, k: newScale });
    } else {
      if (mode !== 'draw' && mode !== 'erase') {
          setTransform(prev => ({
            ...prev,
            x: prev.x - e.deltaX,
            y: prev.y - e.deltaY
          }));
      }
    }
  }, [transform]);

  const zoomIn = () => setTransform(prev => ({ ...prev, k: Math.min(5, prev.k + 0.1) }));
  const zoomOut = () => setTransform(prev => ({ ...prev, k: Math.max(0.1, prev.k - 0.1) }));

  return { transform, setTransform, screenToWorld, handleWheel, zoomIn, zoomOut };
};
