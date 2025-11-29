
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { FileType } from '../types';
import { FileText, Folder, Box } from 'lucide-react';

interface CreateNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, type: FileType) => void;
  initialType: FileType;
  parentName: string;
}

export const CreateNodeModal: React.FC<CreateNodeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialType,
  parentName
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<FileType>(initialType);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setType(initialType);
    }
  }, [isOpen, initialType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onConfirm(name, type);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Item"
      footer={
        <>
           <button 
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
           >
              Cancel
           </button>
           <button 
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="px-4 py-2 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
           >
              Create
           </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type Selection */}
        <div className="grid grid-cols-3 gap-2">
            <button
                type="button"
                onClick={() => setType(FileType.CANVAS)}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${type === FileType.CANVAS ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
            >
                <Box className="w-6 h-6 mb-2" />
                <span className="text-xs font-medium">Canvas</span>
            </button>
            <button
                type="button"
                onClick={() => setType(FileType.FILE)}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${type === FileType.FILE ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
            >
                <FileText className="w-6 h-6 mb-2" />
                <span className="text-xs font-medium">File</span>
            </button>
            <button
                type="button"
                onClick={() => setType(FileType.FOLDER)}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${type === FileType.FOLDER ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
            >
                <Folder className="w-6 h-6 mb-2" />
                <span className="text-xs font-medium">Folder</span>
            </button>
        </div>

        {/* Name Input */}
        <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Name</label>
            <input 
                autoFocus
                type="text" 
                placeholder={type === FileType.FOLDER ? "Folder Name" : "File Name"}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder-zinc-700"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
        </div>

        {/* Location Info */}
        <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900/50 p-2 rounded border border-zinc-800/50">
            <span>Creating in:</span>
            <Folder className="w-3 h-3" />
            <span className="text-zinc-300 font-medium truncate">{parentName}</span>
        </div>
      </form>
    </Modal>
  );
};
