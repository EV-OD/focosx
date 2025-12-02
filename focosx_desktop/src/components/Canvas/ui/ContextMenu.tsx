import React, { useEffect, useRef } from 'react';
import { BringToFront, SendToBack, Trash2, ArrowUp, ArrowDown, Copy, Pencil } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  frameId: string;
  onClose: () => void;
  onAction: (action: string, frameId: string) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, frameId, onClose, onAction }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use mousedown to capture clicks immediately
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleAction = (action: string) => {
      onAction(action, frameId);
      onClose();
  };

  // Prevent menu from going off-screen (basic implementation)
  const style: React.CSSProperties = {
      top: Math.min(y, window.innerHeight - 240),
      left: Math.min(x, window.innerWidth - 160),
  };

  return (
    <div 
      ref={menuRef}
      className="fixed z-[100] bg-surface border border-border rounded-lg shadow-2xl p-1 min-w-[180px] flex flex-col animate-in fade-in zoom-in-95 duration-100"
      style={style}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-2 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 mb-1">
        Actions
      </div>
      <button onClick={() => handleAction('rename')} className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 rounded text-left transition-colors">
          <Pencil className="w-4 h-4 text-zinc-500" />
          <span>Rename</span>
      </button>

      <div className="h-px bg-zinc-800 my-1" />
      <div className="px-2 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
        Arrange
      </div>

      <button onClick={() => handleAction('bring-front')} className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 rounded text-left transition-colors">
          <BringToFront className="w-4 h-4 text-zinc-500" />
          <span>Bring to Front</span>
      </button>
       <button onClick={() => handleAction('bring-forward')} className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 rounded text-left transition-colors">
          <ArrowUp className="w-4 h-4 text-zinc-500" />
          <span>Bring Forward</span>
      </button>
       <button onClick={() => handleAction('send-backward')} className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 rounded text-left transition-colors">
          <ArrowDown className="w-4 h-4 text-zinc-500" />
          <span>Send Backward</span>
      </button>
      <button onClick={() => handleAction('send-back')} className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 rounded text-left transition-colors">
          <SendToBack className="w-4 h-4 text-zinc-500" />
          <span>Send to Back</span>
      </button>
      
      <div className="h-px bg-zinc-800 my-1" />
      
      <button onClick={() => handleAction('delete')} className="flex items-center gap-2 px-2 py-1.5 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 rounded text-left transition-colors">
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
      </button>
    </div>
  );
};