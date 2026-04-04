'use client';

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
}

export function ResizeHandle({ onMouseDown }: ResizeHandleProps) {
  return (
    <div
      className="absolute inset-y-0 right-0 w-1 cursor-col-resize select-none bg-border/40 hover:bg-primary/60 active:bg-primary transition-colors z-10"
      onMouseDown={onMouseDown}
      title="Kéo để thay đổi độ rộng cột"
    />
  );
}
