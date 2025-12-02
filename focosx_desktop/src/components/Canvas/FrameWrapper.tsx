
import React, { useRef, useEffect, useState } from 'react';
import { FrameData, InteractionMode } from '../../types';
import { PluginManager } from '../../plugins/PluginManager';
import { Move, X, Maximize2, Check } from 'lucide-react';
import { CustomToolConfig } from '../../plugins/api/types';

interface FrameWrapperProps {
  frame: FrameData;
  mode: InteractionMode;
  zoom: number;
  isSelected: boolean;
  isRenaming: boolean;
  isFrontDrawing: boolean;
  customTool?: CustomToolConfig | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<FrameData>) => void;
  onPersist?: () => void; 
  onDelete: (id: string) => void;
  onInternalDrawStart: (e: React.PointerEvent, frameId: string, relativeTo: DOMRect) => void;
  onInternalDrawMove: (e: React.PointerEvent, frameId: string, relativeTo: DOMRect) => void;
  onInternalDrawEnd: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent, frameId: string) => void;
  onFocus: (id: string) => void;
  onRenameEnd: () => void;
}

export const FrameWrapper: React.FC<FrameWrapperProps> = React.memo(({
  frame,
  mode,
  zoom,
  isSelected,
  isRenaming,
  isFrontDrawing,
  customTool,
  onSelect,
  onUpdate,
  onPersist,
  onDelete,
  onInternalDrawStart,
  onInternalDrawMove,
  onInternalDrawEnd,
  onContextMenu,
  onFocus,
  onRenameEnd
}) => {
  const frameDef = PluginManager.getFrameType(frame.type);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [renameValue, setRenameValue] = useState(frame.name || 'Frame');
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ w: 0, h: 0, x: 0, y: 0 });

  useEffect(() => {
    setRenameValue(frame.name || frameDef?.label || 'Frame');
  }, [frame.name, frameDef]);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = () => {
      if (renameValue.trim() && renameValue !== frame.name) {
          onUpdate(frame.id, { name: renameValue.trim() });
          if (onPersist) onPersist();
      } else {
          setRenameValue(frame.name || '');
      }
      onRenameEnd();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    
    // Set focus to the frame container to allow keyboard shortcuts (like Delete) to work
    // But check if we clicked a native input element first
    const target = e.target as HTMLElement;
    if (!['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName) && !target.isContentEditable) {
        boxRef.current?.focus();
    }

    if (isFrontDrawing && (mode === 'draw' || mode === 'erase')) return;
    
    // If a custom tool (e.g. PDF pen) is active, don't drag
    if (customTool && mode === 'draw') return;

    if (mode !== 'select' && mode !== 'pan') return; 
    if ((e.target as HTMLElement).closest('.resize-handle')) return;
    if (isRenaming) return; 

    const dragHandleMode = frameDef?.interaction?.dragHandle || 'header';
    const isHeader = (e.target as HTMLElement).closest('.frame-header');

    if (dragHandleMode === 'header' && !isHeader) {
        onSelect(frame.id);
        return;
    }

    if (dragHandleMode === 'everywhere') {
        if (['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A'].includes(target.tagName) || target.closest('button') || target.closest('.interactive')) {
            return;
        }
    }
    
    e.stopPropagation();
    onSelect(frame.id);
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - frame.x * zoom,
      y: e.clientY - frame.y * zoom
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      e.stopPropagation();
      const newX = (e.clientX - dragOffset.current.x) / zoom;
      const newY = (e.clientY - dragOffset.current.y) / zoom;
      onUpdate(frame.id, { x: newX, y: newY });
    } else if (isResizing) {
      e.stopPropagation();
      const deltaX = (e.clientX - resizeStart.current.x) / zoom;
      const deltaY = (e.clientY - resizeStart.current.y) / zoom;
      onUpdate(frame.id, {
        width: Math.max(100, resizeStart.current.w + deltaX),
        height: Math.max(100, resizeStart.current.h + deltaY)
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging || isResizing) {
      setIsDragging(false);
      setIsResizing(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      if (onPersist) onPersist();
    }
  };

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStart.current = {
      w: frame.width,
      h: frame.height,
      x: e.clientX,
      y: e.clientY
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleContentPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    if (mode === 'draw' || mode === 'erase') {
      if (isFrontDrawing) return;
      if (customTool) return; // Let plugin handle it

      e.stopPropagation();
      if (contentRef.current) {
         const scrollContainer = contentRef.current?.querySelector('.overflow-y-auto') || contentRef.current;
         if (scrollContainer) {
             onInternalDrawStart(e, frame.id, scrollContainer.getBoundingClientRect());
         }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
      if (frameDef?.interaction?.captureWheel) {
          e.stopPropagation();
      }
  };

  if (!frameDef) return null;

  const PluginComponent = frameDef.component;
  const showHeader = frameDef.interaction?.dragHandle !== 'everywhere';

  return (
    <div
      ref={boxRef}
      tabIndex={-1}
      className={`absolute flex flex-col shadow-2xl rounded-md overflow-hidden border bg-surface outline-none
        ${isSelected ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-border'}
        ${mode === 'draw' && !isFrontDrawing ? '' : 'hover:border-zinc-600'}
      `}
      style={{
        transform: `translate(${frame.x}px, ${frame.y}px)`,
        width: frame.width,
        height: frame.height,
        zIndex: isSelected ? 50 : 10,
        touchAction: 'none' 
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isSelected) onSelect(frame.id);
          onContextMenu(e, frame.id);
      }}
    >
      {showHeader && (
        <div className={`frame-header h-7 bg-zinc-800/90 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing opacity-0 hover:opacity-100 transition-opacity ${isSelected || isRenaming ? 'opacity-100' : ''}`}>
           <div className="flex items-center gap-2 text-xs text-zinc-400 flex-1 mr-2 min-w-0">
              <Move className="w-3 h-3 shrink-0" />
              {isRenaming ? (
                 <input 
                    ref={renameInputRef}
                    type="text" 
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
                    className="bg-zinc-900 text-zinc-200 border border-blue-500 rounded px-1 py-0.5 w-full outline-none"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                 />
              ) : (
                 <span className="truncate font-medium text-zinc-300" onDoubleClick={(e) => { e.stopPropagation(); onContextMenu(e as any, frame.id); }}>
                    {frame.name || frameDef.label}
                 </span>
              )}
           </div>
           
           <div className="flex items-center gap-1">
               <button
                 className="p-1 text-zinc-500 hover:text-blue-400 hover:bg-zinc-700 rounded"
                 onClick={(e) => { e.stopPropagation(); onFocus(frame.id); }}
                 title="Focus Mode"
               >
                   <Maximize2 className="w-3 h-3" />
               </button>
               <button 
                  className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-700 rounded"
                  onClick={(e) => { e.stopPropagation(); onDelete(frame.id); }}
                  title="Delete"
               >
                   <X className="w-3 h-3" />
               </button>
           </div>
        </div>
      )}

      <div 
        ref={contentRef}
        className="flex-1 relative isolate overflow-hidden"
        onPointerDown={handleContentPointerDown}
        onPointerMove={(e) => {
            if ((mode === 'draw' || mode === 'erase') && !isFrontDrawing && !customTool) {
                 const scrollContainer = contentRef.current?.querySelector('.overflow-y-auto') || contentRef.current;
                 if (scrollContainer) {
                    onInternalDrawMove(e, frame.id, scrollContainer.getBoundingClientRect());
                 }
            }
        }}
        onPointerUp={(e) => {
             if ((mode === 'draw' || mode === 'erase') && !isFrontDrawing && !customTool) {
                onInternalDrawEnd(e);
             }
        }}
        onWheel={handleWheel}
      >
        <PluginComponent 
          frame={frame} 
          isActive={isSelected} 
          mode={mode} 
          scale={zoom}
          isResizing={isResizing}
          isFocused={false}
          customTool={customTool}
          onUpdate={(updates) => onUpdate(frame.id, updates)} 
          onDelete={() => onDelete(frame.id)}
        />
      </div>

      {(isSelected || mode === 'select') && (
        <div 
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-transparent resize-handle z-50"
          onPointerDown={startResize}
        >
             <div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-500 rounded-sm" />
        </div>
      )}
    </div>
  );
});