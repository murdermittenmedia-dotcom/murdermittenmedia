import { useState, useRef, useEffect } from "react";
import { X, Minimize2, Maximize2 } from "lucide-react";

interface FloatingWindowProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  defaultWidth?: number;
  defaultHeight?: number;
  defaultX?: number;
  defaultY?: number;
}

export function FloatingWindow({
  title,
  children,
  onClose,
  defaultWidth = 400,
  defaultHeight = 600,
  defaultX = 20,
  defaultY = 20,
}: FloatingWindowProps) {
  const [position, setPosition] = useState({ x: defaultX, y: defaultY });
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    });
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      setSize({
        width: Math.max(300, resizeStart.width + deltaX),
        height: Math.max(200, resizeStart.height + deltaY),
      });
    };
    const handleMouseUp = () => setIsResizing(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, resizeStart]);

  return (
    <div
      ref={windowRef}
      className="fixed bg-black/95 border border-red-600/50 rounded-lg shadow-2xl z-50 flex flex-col"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isMinimized ? "auto" : `${size.width}px`,
        height: isMinimized ? "auto" : `${size.height}px`,
      }}
    >
      <div
        onMouseDown={handleMouseDown}
        className="bg-gradient-to-r from-red-900/40 to-red-800/20 border-b border-red-600/30 px-4 py-2 flex items-center justify-between cursor-move select-none"
      >
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-red-600/30 rounded transition-colors"
            title={isMinimized ? "Restore" : "Minimize"}
          >
            {isMinimized ? (
              <Maximize2 size={14} className="text-red-400" />
            ) : (
              <Minimize2 size={14} className="text-red-400" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-red-600/30 rounded transition-colors"
            title="Close"
          >
            <X size={14} className="text-red-400" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 overflow-y-auto p-4 text-white text-sm">
          {children}
        </div>
      )}

      {!isMinimized && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-4 h-4 bg-red-600/50 hover:bg-red-500 cursor-se-resize rounded-bl"
          title="Drag to resize"
          style={{ cursor: "nwse-resize" }}
        />
      )}
    </div>
  );
}
