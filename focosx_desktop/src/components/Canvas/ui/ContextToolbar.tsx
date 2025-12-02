import React from 'react';
import { FrameData } from '../../../types';
import { PluginManager } from '../../../plugins/PluginManager';

interface ContextToolbarProps {
  selectedFrameIds: Set<string>;
  frames: FrameData[];
  onUpdateFrame: (id: string, updates: Partial<FrameData>) => void;
}

export const ContextToolbar: React.FC<ContextToolbarProps> = ({
  selectedFrameIds,
  frames,
  onUpdateFrame
}) => {
  if (selectedFrameIds.size !== 1) return null;
  
  const frame = frames.find(f => f.id === Array.from(selectedFrameIds)[0]);
  if (!frame) return null;

  const def = PluginManager.getFrameType(frame.type);
  if (!def || !def.customTools || def.customTools.length === 0) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto animate-in slide-in-from-top-4 fade-in">
      <div className="bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl px-2 py-1.5 shadow-xl flex items-center gap-1">
        <span className="text-[10px] uppercase font-bold text-zinc-500 px-2">{def.label} Tools</span>
        <div className="w-px h-4 bg-zinc-700 mx-1" />
        {def.customTools.map(tool => (
          <button
            key={tool.id}
            onClick={() => tool.onClick(frame, (u) => onUpdateFrame(frame.id, u))}
            className="p-1.5 rounded-lg text-zinc-300 hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-2"
            title={tool.label}
          >
            {tool.icon}
            <span className="text-xs font-medium hidden sm:inline-block">{tool.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};