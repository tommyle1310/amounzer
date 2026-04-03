'use client';

import { useState, useRef, useCallback } from 'react';

interface DragState {
  idx: number;
  startX: number;
  startW: number;
}

const MIN_COLUMN_WIDTH = 40;

export function useResizableColumns(defaults: readonly number[]) {
  const [widths, setWidths] = useState<number[]>(() => [...defaults]);
  const dragging = useRef<DragState | null>(null);

  const startResize = useCallback(
    (idx: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = {
        idx,
        startX: e.clientX,
        startW: widths[idx] ?? defaults[idx] ?? 80,
      };

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const { idx: i, startX, startW } = dragging.current;
        const delta = ev.clientX - startX;
        setWidths((prev) => {
          const next = [...prev];
          next[i] = Math.max(MIN_COLUMN_WIDTH, startW + delta);
          return next;
        });
      };

      const onUp = () => {
        dragging.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [widths, defaults]
  );

  return { widths, startResize };
}
