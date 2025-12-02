
import React, { useState, useRef, useEffect } from 'react';
import { InteractionMode } from '../../../types';
import { MousePointer2, Hand, ZoomIn, ZoomOut, Settings, Check, AlignLeft, AlignCenter, AlignRight, Layers, LayoutPanelTop, Undo2, Redo2 } from 'lucide-react';

interface NavigationToolsProps {
  mode: InteractionMode;
  zoom: number;
  onSetMode: (mode: InteractionMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  
  // History
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Settings Props
  isFrontDrawing: boolean;
  onToggleFrontDrawing: () => void;
  toolbarAlignment: 'left' | 'center' | 'right';
  onSetToolbarAlignment: (align: 'left' | 'center' | 'right') => void;
}

export const NavigationTools: React.FC<NavigationToolsProps> = ({
  mode,
  zoom,
  onSetMode,
  onZoomIn,
  onZoomOut,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isFrontDrawing,
  onToggleFrontDrawing,
  toolbarAlignment,
  onSetToolbarAlignment
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none">
      {/* Unified Floating Island */}
      <div className="pointer-events-auto flex items-center p-1 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-xl shadow-xl">
        
        {/* Interaction Modes */}
        <div className="flex items-center gap-1">
          <button 
            onClick={() => onSetMode('select')}
            className={`p-2 rounded-lg transition-all active:scale-95 ${mode === 'select' ? 'bg-zinc-800 text-blue-400 shadow-inner' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
            title="Select Tool (V)"
          >
            <MousePointer2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onSetMode('pan')}
            className={`p-2 rounded-lg transition-all active:scale-95 ${mode === 'pan' ? 'bg-zinc-800 text-blue-400 shadow-inner' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
            title="Pan Tool (H)"
          >
            <Hand className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-6 bg-zinc-800 mx-1" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
           <button 
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-2 rounded-lg transition-all active:scale-95 ${canUndo ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-700 cursor-not-allowed'}`}
            title="Undo (Ctrl+Z)"
           >
             <Undo2 className="w-4 h-4" />
           </button>
           <button 
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-2 rounded-lg transition-all active:scale-95 ${canRedo ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-700 cursor-not-allowed'}`}
            title="Redo (Ctrl+Y)"
           >
             <Redo2 className="w-4 h-4" />
           </button>
        </div>

        <div className="w-px h-6 bg-zinc-800 mx-1" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button 
            onClick={onZoomOut}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors active:scale-95"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-medium text-zinc-500 w-[42px] text-center select-none cursor-default">
            {Math.round(zoom * 100)}%
          </span>
          <button 
            onClick={onZoomIn}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors active:scale-95"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-6 bg-zinc-800 mx-1" />

        {/* Settings Toggle */}
        <div className="relative" ref={settingsRef}>
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-2 rounded-lg transition-all active:scale-95 ${isSettingsOpen ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
            title="View Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Settings Dropdown */}
          {isSettingsOpen && (
            <div className="absolute top-full right-0 mt-3 w-64 bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 origin-top-right">
                
                {/* Header */}
                <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                        <Settings className="w-3 h-3" />
                        Canvas Preferences
                    </span>
                </div>

                <div className="p-2 space-y-1">
                    {/* Layering Toggle */}
                    <button 
                        onClick={onToggleFrontDrawing}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-md bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-zinc-200">
                                <Layers className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-sm font-medium text-zinc-300">Front Drawing</span>
                                <span className="text-[10px] text-zinc-500">Draw over all frames</span>
                            </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isFrontDrawing ? 'bg-blue-600 border-blue-600' : 'border-zinc-600'}`}>
                            {isFrontDrawing && <Check className="w-3 h-3 text-white" />}
                        </div>
                    </button>
                </div>
                
                <div className="h-px bg-zinc-800 mx-2" />

                <div className="p-3">
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3 px-1">
                        <LayoutPanelTop className="w-3 h-3" />
                        <span>Toolbar Position</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
                        <button 
                            onClick={() => onSetToolbarAlignment('left')} 
                            className={`flex flex-col items-center gap-1 p-2 rounded-md transition-all ${toolbarAlignment === 'left' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                            title="Left"
                        >
                            <AlignLeft className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => onSetToolbarAlignment('center')} 
                            className={`flex flex-col items-center gap-1 p-2 rounded-md transition-all ${toolbarAlignment === 'center' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                            title="Center"
                        >
                            <AlignCenter className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => onSetToolbarAlignment('right')} 
                            className={`flex flex-col items-center gap-1 p-2 rounded-md transition-all ${toolbarAlignment === 'right' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                            title="Right"
                        >
                            <AlignRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
