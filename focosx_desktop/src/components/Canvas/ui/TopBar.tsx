import React, { useState, useRef, useEffect } from 'react';
import { PluginManager } from '../../../plugins/PluginManager';
import { Plus, Save, ChevronDown, Search, Check, Puzzle, Download, Loader2, Cloud, CloudOff, FileJson, Image, Box, MoreVertical, LayoutGrid } from 'lucide-react';

interface TopBarProps {
  canvasName: string;
  saveStatus?: 'saved' | 'saving' | 'unsaved';
  activeAddType: string;
  onSetActiveAddType: (id: string) => void;
  onAddFrame: (typeId: string) => void;
  onSave: () => void;
  onExportImage: () => void;
  onExportFile: () => void;
  onOpenPluginStore: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  canvasName,
  saveStatus = 'saved',
  activeAddType,
  onSetActiveAddType,
  onAddFrame,
  onSave,
  onExportImage,
  onExportFile,
  onOpenPluginStore
}) => {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  
  const [allFrameTypes, setAllFrameTypes] = useState(PluginManager.getAllFrameTypes());
  const addMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      return PluginManager.subscribe(() => {
          setAllFrameTypes(PluginManager.getAllFrameTypes());
      });
  }, []);

  const activeFrameDef = PluginManager.getFrameType(activeAddType);

  const filteredFrameTypes = allFrameTypes.filter(t => 
    t.label.toLowerCase().includes(menuSearch.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
          setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Status Indicator Component ---
  const StatusIndicator = () => {
    if (saveStatus === 'saving') {
      return (
        <div className="flex items-center gap-1.5" title="Saving...">
          <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
        </div>
      );
    }
    if (saveStatus === 'unsaved') {
      return (
        <div className="flex items-center gap-1.5" title="Unsaved changes">
          <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 group relative" title="All changes saved">
         <Cloud className="w-3.5 h-3.5 text-zinc-600 group-hover:text-green-500 transition-colors" />
      </div>
    );
  };

  return (
    <div className="absolute inset-x-0 top-0 p-4 z-50 pointer-events-none flex justify-between items-start">
      
      {/* --- LEFT: File Context & Actions --- */}
      <div className="pointer-events-auto flex flex-col items-start gap-2">
          <div className="flex items-center gap-1 p-1 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-xl shadow-xl">
            
            {/* File Info */}
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors cursor-default">
               <div className="p-1.5 bg-zinc-800 rounded-md text-blue-400">
                  <Box className="w-3.5 h-3.5" />
               </div>
               <div className="flex flex-col justify-center">
                   <span className="text-xs font-bold text-zinc-200 leading-none max-w-[140px] truncate">{canvasName}</span>
                   <span className="text-[9px] text-zinc-500 font-medium mt-0.5">Canvas Board</span>
               </div>
            </div>

            <div className="w-px h-6 bg-zinc-800 mx-1" />

            {/* Status */}
            <div className="px-2 flex items-center justify-center">
                <StatusIndicator />
            </div>

            <div className="w-px h-6 bg-zinc-800 mx-1" />

            {/* Quick Actions */}
            <button 
              onClick={onSave}
              className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded-lg transition-all active:scale-95"
              title="Save (Ctrl+S)"
            >
              <Save className="w-4 h-4" />
            </button>

            <div className="relative" ref={exportMenuRef}>
              <button 
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className={`p-2 rounded-lg transition-all active:scale-95 flex items-center gap-1 ${isExportMenuOpen ? 'text-green-400 bg-zinc-800' : 'text-zinc-400 hover:text-green-400 hover:bg-zinc-800'}`}
                title="Export"
              >
                <Download className="w-4 h-4" />
              </button>

              {isExportMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-60 bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 z-50">
                    <div className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-900/50 border-b border-zinc-800">
                        Export Options
                    </div>
                    
                    <button 
                        onClick={() => { onExportImage(); setIsExportMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-3 hover:bg-zinc-800 text-left transition-colors group"
                    >
                        <div className="p-2 bg-green-500/10 text-green-500 rounded-lg group-hover:bg-green-500/20 group-hover:scale-105 transition-all">
                            <Image className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-zinc-200">Export Image</span>
                            <span className="text-[10px] text-zinc-500">Save current view as PNG</span>
                        </div>
                    </button>

                    <button 
                        onClick={() => { onExportFile(); setIsExportMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-3 hover:bg-zinc-800 text-left transition-colors border-t border-zinc-800/50 group"
                    >
                        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg group-hover:bg-blue-500/20 group-hover:scale-105 transition-all">
                            <FileJson className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-zinc-200">Save File</span>
                            <span className="text-[10px] text-zinc-500">Download .canvas JSON</span>
                        </div>
                    </button>
                </div>
              )}
            </div>
          </div>
      </div>

      {/* --- CENTER: Creation Tools --- */}
      <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 top-4">
         <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-xl shadow-xl p-1 flex items-center gap-1" ref={addMenuRef}>
             
             {/* Primary Add Button */}
             <button
                onClick={() => onAddFrame(activeAddType)}
                className="flex items-center gap-2 pl-3 pr-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg border border-zinc-700 transition-all active:scale-95 group shadow-sm"
                title={`Quick Add: ${activeFrameDef?.label}`}
             >
                <div className="text-blue-400 group-hover:scale-110 transition-transform">
                   {activeFrameDef?.icon || <Plus className="w-4 h-4" />}
                </div>
                <span className="text-sm font-medium">Add {activeFrameDef?.label}</span>
             </button>

             <div className="w-px h-6 bg-zinc-800 mx-1" />

             {/* Menu Trigger */}
             <button
                onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                className={`p-2 rounded-lg transition-all ${isAddMenuOpen ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                title="Tools Menu"
             >
                <LayoutGrid className="w-4 h-4" />
             </button>

             {/* Plugin Store */}
             <button
                onClick={onOpenPluginStore}
                className="p-2 rounded-lg text-zinc-400 hover:text-purple-400 hover:bg-zinc-800 transition-all"
                title="Extension Store"
             >
                <Puzzle className="w-4 h-4" />
             </button>

             {/* Creation Dropdown */}
             {isAddMenuOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 origin-top z-50">
                    <div className="p-3 border-b border-zinc-800 bg-zinc-900/50">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                            <input 
                                type="text" 
                                autoFocus
                                placeholder="Search tools..."
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 placeholder-zinc-600"
                                value={menuSearch}
                                onChange={(e) => setMenuSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="max-h-64 overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-zinc-800">
                        {filteredFrameTypes.map(type => (
                            <button
                                key={type.id}
                                onClick={() => {
                                    onSetActiveAddType(type.id);
                                    setIsAddMenuOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors group ${activeAddType === type.id ? 'bg-blue-900/20' : 'hover:bg-zinc-800'}`}
                            >
                                <div className={`p-1.5 rounded-md ${activeAddType === type.id ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'}`}>
                                    {type.icon}
                                </div>
                                <div className="flex flex-col flex-1 min-w-0">
                                    <span className={`text-sm font-medium truncate ${activeAddType === type.id ? 'text-blue-200' : 'text-zinc-300'}`}>{type.label}</span>
                                    <span className="text-[10px] text-zinc-500 truncate">{type.pluginName}</span>
                                </div>
                                {activeAddType === type.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
                            </button>
                        ))}
                        {filteredFrameTypes.length === 0 && (
                            <div className="py-4 text-center text-xs text-zinc-500">No tools found</div>
                        )}
                    </div>
                    
                    <div className="p-2 border-t border-zinc-800 bg-zinc-900/30">
                        <button 
                            onClick={() => { setIsAddMenuOpen(false); onOpenPluginStore(); }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 hover:text-white rounded-lg transition-colors border border-zinc-700 hover:border-zinc-600"
                        >
                            <Puzzle className="w-3.5 h-3.5" />
                            Browse Extensions
                        </button>
                    </div>
                </div>
             )}
         </div>
      </div>

    </div>
  );
};
