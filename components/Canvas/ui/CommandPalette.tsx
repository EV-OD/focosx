import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Command, Box, Eye, Plus } from 'lucide-react';
import { FrameData } from '../../../types';
import { PluginManager } from '../../../plugins/PluginManager';

interface CommandPaletteProps {
  mode: 'commands' | 'frames';
  frames: FrameData[];
  onClose: () => void;
  onFocusFrame: (id: string) => void;
  onAddFrame: (typeId: string) => void;
}

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  group: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  mode,
  frames,
  onClose,
  onFocusFrame,
  onAddFrame
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items: CommandItem[] = useMemo(() => {
    if (mode === 'frames') {
      return frames.map(frame => ({
        id: frame.id,
        label: frame.name || `Frame (${frame.type})`,
        description: `Jump to ${frame.type}`,
        icon: <Box className="w-4 h-4" />,
        action: () => onFocusFrame(frame.id),
        group: 'Frames'
      }));
    } else {
      // Command Mode
      const allFrameTypes = PluginManager.getAllFrameTypes();
      const addCommands = allFrameTypes.map(type => ({
        id: `add-${type.id}`,
        label: `Add ${type.label}`,
        description: `Insert a new ${type.label} frame`,
        icon: <Plus className="w-4 h-4" />,
        action: () => onAddFrame(type.id),
        group: 'Add New'
      }));

      const existingFrames = frames.map(frame => ({
        id: `focus-${frame.id}`,
        label: `Focus: ${frame.name || frame.type}`,
        icon: <Eye className="w-4 h-4" />,
        action: () => onFocusFrame(frame.id),
        group: 'Navigation'
      }));

      return [...addCommands, ...existingFrames];
    }
  }, [mode, frames, onFocusFrame, onAddFrame]);

  const filteredItems = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return items.filter(item => 
      item.label.toLowerCase().includes(lowerSearch) || 
      item.description?.toLowerCase().includes(lowerSearch)
    );
  }, [items, search]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredItems, selectedIndex, onClose]);

  // Reset index when search changes
  useEffect(() => {
      setSelectedIndex(0);
  }, [search]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[20vh]">
      <div className="w-full max-w-xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-100">
        <div className="flex items-center px-4 py-3 border-b border-border bg-zinc-900/50">
          {mode === 'commands' ? <Command className="w-5 h-5 text-zinc-500 mr-3" /> : <Search className="w-5 h-5 text-zinc-500 mr-3" />}
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-lg text-white placeholder-zinc-600"
            placeholder={mode === 'commands' ? "Type a command..." : "Search frames..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-2">
              <kbd className="hidden sm:inline-block px-2 py-0.5 bg-zinc-800 rounded text-[10px] text-zinc-500 border border-zinc-700">ESC</kbd>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 scroll-py-2">
            {filteredItems.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-sm">No results found.</div>
            ) : (
                filteredItems.map((item, index) => (
                    <button
                        key={item.id}
                        onClick={() => { item.action(); onClose(); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${index === selectedIndex ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
                    >
                        <div className={index === selectedIndex ? 'text-blue-200' : 'text-zinc-500'}>
                            {item.icon}
                        </div>
                        <div className="flex flex-col flex-1 overflow-hidden">
                            <span className={`text-sm font-medium ${index === selectedIndex ? 'text-white' : 'text-zinc-300'}`}>
                                {item.label}
                            </span>
                            {item.description && (
                                <span className={`text-xs truncate ${index === selectedIndex ? 'text-blue-100' : 'text-zinc-600'}`}>
                                    {item.description}
                                </span>
                            )}
                        </div>
                        {index === selectedIndex && <span className="text-xs opacity-50">↵</span>}
                    </button>
                ))
            )}
        </div>
        
        {mode === 'commands' && (
            <div className="px-4 py-2 bg-zinc-900/50 border-t border-border flex justify-between text-[10px] text-zinc-500">
                 <span><strong className="text-zinc-400">Ctrl+Alt+P</strong> for commands</span>
                 <span><strong className="text-zinc-400">Ctrl+P</strong> to search frames</span>
            </div>
        )}
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
};