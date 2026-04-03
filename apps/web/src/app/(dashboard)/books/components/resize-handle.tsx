'use client';

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
}

export function ResizeHandle({ onMouseDown }: ResizeHandleProps) {
  return (
    <div
      className="absolute inset-y-0 right-0 w-1 cursor-col-resize select-none hover:bg-primary/50 z-10"
      onMouseDown={onMouseDown}
    />
  );
}
