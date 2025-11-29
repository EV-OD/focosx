
import React, { useEffect, useRef } from 'react';
import { Trash2, FileText, Folder, Box } from 'lucide-react';
import { FileType } from '../types';

interface FileContextMenuProps {
  x: number;
  y: number;
  fileName: string;
  fileType: FileType;
  onClose: () => void;
  onDelete: () => void;
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({ x, y, fileName, fileType, onClose, onDelete }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const getIcon = () => {
      switch(fileType) {
          case FileType.FOLDER: return <Folder className="w-3 h-3 text-accent" />;
          case FileType.CANVAS: return <Box className="w-3 h-3 text-purple-400" />;
          default: return <FileText className="w-3 h-3 text-zinc-500" />;
      }
  };

  // Prevent menu from going off-screen
  const adjustedY = Math.min(y, window.innerHeight - 100);
  const adjustedX = Math.min(x, window.innerWidth - 170);

  return (
    <div 
      ref={menuRef}
      className="fixed z-[100] bg-[#18181b] border border-[#27272a] rounded-lg shadow-2xl p-1 min-w-[160px] flex flex-col animate-in fade-in zoom-in-95 duration-100"
      style={{ top: adjustedY, left: adjustedX }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-2 py-1.5 border-b border-[#27272a] mb-1 bg-zinc-800/50 rounded-t">
        <div className="flex items-center gap-2 text-zinc-200 font-medium text-xs truncate">
             {getIcon()}
             <span className="truncate max-w-[120px]">{fileName}</span>
        </div>
      </div>
      
      <button 
        onClick={(e) => { 
            e.stopPropagation();
            onDelete(); 
            onClose(); 
        }} 
        className="flex items-center gap-2 px-2 py-1.5 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 rounded text-left transition-colors"
      >
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
      </button>
    </div>
  );
};
