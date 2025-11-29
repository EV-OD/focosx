
import React, { useState } from 'react';
import { PluginDefinition, PluginFrameProps } from '../api/types';
import { Image as ImageIcon, Upload, Link, Edit2, Trash2 } from 'lucide-react';

const ImageFrame: React.FC<PluginFrameProps> = ({ frame, onUpdate, onDelete }) => {
  const [url, setUrl] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          onUpdate({ content: ev.target.result as string });
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleUrlSubmit = () => {
      if (url.trim()) {
          onUpdate({ content: url.trim() });
      }
  };

  if (!frame.content) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/50 p-4 gap-3 text-zinc-500 backdrop-blur-sm relative">
        <button 
           onClick={onDelete}
           className="absolute top-2 right-2 p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-red-400 transition-colors"
           title="Delete Frame"
        >
            <Trash2 className="w-4 h-4" />
        </button>

        <div className="p-3 bg-zinc-800/50 rounded-full mb-1">
             <ImageIcon className="w-6 h-6 opacity-40" />
        </div>
        
        <div className="flex flex-col w-full max-w-[220px] gap-2">
            {/* URL Input */}
            <div className="flex gap-1.5">
                <input 
                    className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 placeholder-zinc-700 outline-none focus:border-blue-500/50 transition-colors"
                    placeholder="Paste Image URL..."
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
                />
                <button 
                    onClick={handleUrlSubmit} 
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded text-zinc-400 hover:text-white transition-colors"
                    title="Load URL"
                >
                    <Link className="w-3.5 h-3.5" />
                </button>
            </div>
            
            <div className="flex items-center gap-2 text-[10px] text-zinc-700 uppercase font-bold tracking-wider justify-center my-1">
                <span>OR</span>
            </div>

            {/* Upload Button */}
            <div className="relative">
                <input 
                    type="file" 
                    className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                    accept="image/*"
                    onChange={handleFileChange}
                />
                <button className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 hover:border-blue-500/30 rounded text-xs font-medium flex items-center justify-center gap-2 transition-all group">
                    <Upload className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
                    Upload from Device
                </button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative group bg-zinc-900 flex items-center justify-center overflow-hidden">
      <img 
        src={frame.content} 
        className="w-full h-full object-contain select-none pointer-events-none" 
        alt="Frame Content"
        draggable={false}
      />
      
      {/* Overlay Actions */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button 
            onClick={() => onUpdate({ content: '' })}
            className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-md backdrop-blur-md shadow-lg border border-white/10"
            title="Change Image"
        >
            <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button 
            onClick={onDelete}
            className="p-1.5 bg-red-900/80 hover:bg-red-900 text-white rounded-md backdrop-blur-md shadow-lg border border-white/10"
            title="Delete Image"
        >
            <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const ImagePlugin: PluginDefinition = {
  id: 'core-image',
  name: 'Image Frame',
  version: '1.1.0',
  description: 'Display images on the canvas from URL or local upload.',
  frameTypes: {
    'image': {
        label: 'Image',
        icon: <ImageIcon className="w-4 h-4" />,
        component: ImageFrame,
        defaultDimensions: { width: 400, height: 300 },
        handledExtensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'],
        interaction: {
            dragHandle: 'everywhere'
        },
        customTools: [] 
    }
  }
};