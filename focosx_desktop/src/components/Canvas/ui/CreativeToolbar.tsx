
import React from 'react';
import { InteractionMode } from '../../../types';
import { GlobalTool, CustomToolConfig } from '../../../plugins/api/types';
import { BRUSHES, BrushType, COLORS } from '../constants';
import { Eraser, Sliders } from 'lucide-react';

interface CreativeToolbarProps {
  mode: InteractionMode;
  activeBrush: BrushType;
  activeColor: string;
  activeCustomTool: CustomToolConfig | null;
  brushSize: number;
  brushOpacity: number;
  alignment: 'left' | 'center' | 'right';
  isFocused: boolean;
  onSetMode: (mode: InteractionMode) => void;
  onSetActiveBrush: (brush: BrushType) => void;
  onSetActiveColor: (color: string) => void;
  onSetActiveCustomTool: (tool: CustomToolConfig | null) => void;
  onUpdateSettings: (size: number, opacity: number) => void;
  globalPluginTools: GlobalTool[];
}

export const CreativeToolbar: React.FC<CreativeToolbarProps> = ({
  mode,
  activeBrush,
  activeColor,
  activeCustomTool,
  brushSize,
  brushOpacity,
  alignment,
  isFocused,
  onSetMode,
  onSetActiveBrush,
  onSetActiveColor,
  onSetActiveCustomTool,
  onUpdateSettings,
  globalPluginTools
}) => {
  
  const activateBrush = (brushId: BrushType) => {
    // Toggle Logic handled in parent, this just calls handler
    onSetActiveBrush(brushId);
  };

  const handleToolClick = (tool: GlobalTool) => {
     // Toggle Logic handled in parent
     tool.onClick({ 
        setMode: onSetMode, 
        setCustomTool: onSetActiveCustomTool 
     });
  };

  const handleEraserClick = () => {
      if (mode === 'erase') {
          onSetMode('select');
      } else {
          onSetMode('erase');
          onSetActiveCustomTool(null);
      }
  };

  const justifyClass = alignment === 'left' ? 'justify-start pl-8' : 
                       alignment === 'right' ? 'justify-end pr-8' : 
                       'justify-center';

  // --- SETTINGS PANEL COMPONENT ---
  const SettingsPanel = () => (
      <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl p-3 shadow-2xl flex flex-col gap-3 min-w-[200px] animate-in slide-in-from-bottom-2 fade-in zoom-in-95 pointer-events-auto z-[200]">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-bold uppercase tracking-wider mb-1">
              <span>Tool Settings</span>
              <Sliders className="w-3 h-3" />
          </div>
          
          {/* Size Slider */}
          <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Size</span>
                  <span>{brushSize}px</span>
              </div>
              <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={brushSize} 
                  onChange={(e) => onUpdateSettings(Number(e.target.value), brushOpacity)}
                  className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
          </div>

          {/* Opacity Slider */}
           <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Opacity</span>
                  <span>{Math.round(brushOpacity * 100)}%</span>
              </div>
              <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={brushOpacity * 100} 
                  onChange={(e) => onUpdateSettings(brushSize, Number(e.target.value) / 100)}
                  className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
          </div>

          {/* Color Picker (Compact) */}
          <div className="flex gap-1.5 flex-wrap pt-1 border-t border-zinc-700/50">
               {COLORS.map(c => (
                   <button
                        key={c}
                        onClick={() => onSetActiveColor(c)}
                        className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${activeColor === c ? 'border-white scale-110 shadow' : 'border-transparent opacity-80'}`}
                        style={{ backgroundColor: c }}
                   />
               ))}
          </div>
      </div>
  );

  // --- FOCUSED MODE DOCK UI ---
  if (isFocused) {
    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto z-[100] animate-in slide-in-from-bottom-6 fade-in duration-300">
            {(mode === 'draw' || mode === 'erase' || activeCustomTool) && <SettingsPanel />}

            <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md p-2 rounded-2xl border border-zinc-700 shadow-2xl">
                {/* Eraser */}
                <button 
                    onClick={handleEraserClick}
                    className={`p-3 rounded-xl transition-all duration-200 ${mode === 'erase' ? 'bg-red-500/20 text-red-400 shadow-inner ring-1 ring-red-500/30' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50'}`}
                    title="Eraser"
                >
                    <Eraser className="w-5 h-5" />
                </button>

                {globalPluginTools.length > 0 && <div className="w-px h-8 bg-zinc-700/50 mx-1" />}

                {/* Plugin Tools (Highlighter, Pen, etc.) */}
                {globalPluginTools.map(tool => {
                   const isActive = activeCustomTool?.id === tool.id;
                   return (
                        <button
                            key={tool.id}
                            onClick={() => handleToolClick(tool)}
                            className={`p-3 rounded-xl transition-all duration-200 group relative ${isActive ? 'bg-blue-500/20 text-blue-400 shadow-inner ring-1 ring-blue-500/30' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50'}`}
                            title={tool.label}
                        >
                            {tool.icon}
                            {isActive && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />}
                        </button>
                   );
                })}
            </div>
        </div>
    );
  }

  // --- NORMAL MODE BRUSH RACK UI ---
  return (
    <div className={`absolute bottom-0 left-0 right-0 flex items-end z-50 pointer-events-none ${justifyClass}`}>
      {/* Settings Panel appears floating above active tools */}
      {(mode === 'draw' || activeCustomTool) && (
        <div className={`absolute bottom-32 mb-4 pointer-events-auto`}>
             <SettingsPanel />
        </div>
      )}

      <div className="flex items-end gap-4 px-8 pt-4 pb-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent pointer-events-auto rounded-t-xl">
        <button
          onClick={handleEraserClick}
          className={`group relative w-16 transition-all duration-300 ease-out ${mode === 'erase' ? '-translate-y-6' : 'translate-y-2 hover:translate-y-0'}`}
        >
          <div className="h-12 w-full bg-pink-300 rounded-sm shadow-lg border-b-4 border-pink-400 flex items-center justify-center">
            <span className="text-[10px] font-bold text-pink-800 opacity-50 uppercase tracking-widest">Eraser</span>
          </div>
          <div className="h-4 w-full bg-white/90 rounded-sm mt-[-2px] shadow-md" />
        </button>

        {Object.values(BRUSHES).map((brush) => {
          const isActive = mode === 'draw' && activeBrush === brush.id && !activeCustomTool;
          return (
            <button
              key={brush.id}
              onClick={() => activateBrush(brush.id as BrushType)}
              className={`group relative w-10 flex flex-col items-center transition-all duration-300 ease-out ${isActive ? '-translate-y-10' : 'translate-y-4 hover:translate-y-0'}`}
            >
              <div 
                className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[16px] border-l-transparent border-r-transparent relative z-10"
                style={{ borderBottomColor: brush.id === 'pencil' ? '#d4d4d8' : brush.tipColor }} 
              >
                {brush.id !== 'pencil' && (
                  <div 
                    className="absolute -bottom-4 -left-1.5 w-3 h-3 rounded-full opacity-80"
                    style={{ backgroundColor: activeColor }}
                  />
                )}
                {brush.id === 'pencil' && (
                  <div className="absolute top-[14px] -left-[2px] w-1 h-1 bg-zinc-800 rounded-full" /> 
                )}
              </div>
              
              <div 
                className={`w-full ${brush.heightClass} rounded-t-sm rounded-b-lg shadow-xl flex flex-col items-center justify-end pb-2 border-x border-white/10`}
                style={{ 
                  backgroundColor: brush.id === 'pencil' ? '#fcd34d' : 
                                  brush.id === 'pen' ? '#27272a' : '#dadada'
                }}
              >
                {brush.id === 'pencil' && (
                  <div className="w-full h-4 bg-pink-300 absolute bottom-0 rounded-b-lg border-t border-zinc-400/30" />
                )}
                {brush.id === 'pen' && (
                  <div className="w-1 h-full bg-zinc-800/50" />
                )}
                {brush.id === 'marker' && (
                  <div className="w-full h-12 absolute top-0 bg-white/80" style={{ backgroundColor: activeColor, opacity: 0.5 }} />
                )}
              </div>
            </button>
          );
        })}

        {globalPluginTools.length > 0 && <div className="w-px h-12 bg-white/20 mx-2" />}

        {globalPluginTools.map(tool => {
          const isActive = activeCustomTool?.id === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool)}
              className={`group relative ${tool.appearance.widthClass} flex flex-col items-center transition-all duration-300 ease-out ${isActive ? '-translate-y-10' : 'translate-y-4 hover:translate-y-0'}`}
            >
              <div className="relative z-10 mb-[-4px] drop-shadow-md">
                <div 
                  className="w-8 h-8 rounded flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: isActive ? activeColor : (tool.appearance.tipColor || tool.appearance.color) }}
                >
                  <span className="text-white/90">{tool.icon}</span>
                </div>
              </div>
              
              <div 
                className={`w-full ${tool.appearance.heightClass} rounded-t-sm rounded-b-lg shadow-xl flex flex-col items-center justify-end pb-2 border-x border-white/10`}
                style={{ backgroundColor: tool.appearance.color }}
              >
                <span 
                  className="text-[10px] font-bold uppercase tracking-widest rotate-180 opacity-60 mb-4" 
                  style={{ color: tool.appearance.labelColor || 'white', writingMode: 'vertical-rl' }}
                >
                  {tool.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
