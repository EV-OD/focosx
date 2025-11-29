import React, { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { PluginManager } from '../../plugins/PluginManager';
import { Settings, FileText, Check, Box, ChevronRight, Sliders } from 'lucide-react';
import { FileRendererDefinition } from '../../plugins/api/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [groupedHandlers, setGroupedHandlers] = useState<Record<string, FileRendererDefinition[]>>({});
  const [preferences, setPreferences] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
        // 1. Collect all renderers grouped by extension
        const plugins = PluginManager.getAllActivePlugins();
        const groups: Record<string, FileRendererDefinition[]> = {};
        const prefs: Record<string, string> = {};

        plugins.forEach(p => {
            if (p.fileRenderers) {
                Object.values(p.fileRenderers).forEach(r => {
                    r.handledExtensions.forEach(ext => {
                        const normalizedExt = ext.toLowerCase();
                        if (!groups[normalizedExt]) groups[normalizedExt] = [];
                        groups[normalizedExt].push(r);
                    });
                });
            }
        });

        // 2. Load current preferences
        Object.keys(groups).forEach(ext => {
            const current = PluginManager.getPreferredFileRenderer(ext);
            if (current) prefs[ext] = current.id;
        });

        setGroupedHandlers(groups);
        setPreferences(prefs);
    }
  }, [isOpen]);

  const handleSetPreference = async (ext: string, id: string) => {
      await PluginManager.setPreferredRenderer(ext, id);
      setPreferences(prev => ({ ...prev, [ext]: id }));
  };

  const extensions = Object.keys(groupedHandlers).sort();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Preferences"
      maxWidth="max-w-5xl"
      footer={
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Done
          </button>
      }
    >
      <div className="flex h-[600px]">
          {/* Sidebar */}
          <div className="w-64 border-r border-zinc-800 bg-surface flex flex-col">
              <div className="p-3 space-y-1">
                  <div className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      System
                  </div>
                  <button 
                    onClick={() => setActiveTab('general')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-between ${activeTab === 'general' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                  >
                      <span className="flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          General
                      </span>
                      {activeTab === 'general' && <ChevronRight className="w-3 h-3 text-zinc-500" />}
                  </button>
                  <button 
                    onClick={() => setActiveTab('handlers')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-between ${activeTab === 'handlers' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                  >
                       <span className="flex items-center gap-2">
                          <Sliders className="w-4 h-4" />
                          File Handlers
                      </span>
                      {activeTab === 'handlers' && <ChevronRight className="w-3 h-3 text-zinc-500" />}
                  </button>
              </div>
          </div>

          {/* Content */}
          <div className="flex-1 bg-[#09090b] overflow-y-auto">
              {activeTab === 'general' && (
                  <div className="p-8 max-w-3xl">
                      <div className="mb-6 border-b border-zinc-800 pb-4">
                          <h3 className="text-lg font-bold text-zinc-100 mb-1">General Settings</h3>
                          <p className="text-sm text-zinc-500">Configure global application behavior.</p>
                      </div>
                      
                      <div className="space-y-6">
                          <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/30">
                              <p className="text-sm text-zinc-400">Application settings are currently limited in this demo.</p>
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'handlers' && (
                  <div className="p-8 max-w-3xl">
                      <div className="mb-6 border-b border-zinc-800 pb-4">
                          <h3 className="text-lg font-bold text-zinc-100 mb-1">File Type Associations</h3>
                          <p className="text-sm text-zinc-500">Manage which plugins are used to open specific file types.</p>
                      </div>

                      {extensions.length === 0 ? (
                          <div className="text-center text-zinc-500 py-12 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/20">
                              <Box className="w-10 h-10 mx-auto mb-3 opacity-20" />
                              <p className="text-sm font-medium">No configurable file handlers found.</p>
                              <p className="text-xs mt-1 opacity-60">Install plugins that support file editing to see options here.</p>
                          </div>
                      ) : (
                          <div className="space-y-8">
                              {extensions.map(ext => (
                                  <div key={ext} className="space-y-3">
                                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                          <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-mono border border-blue-500/20">.{ext}</span>
                                          Handler
                                      </h4>
                                      
                                      <div className="grid grid-cols-1 gap-2">
                                          {groupedHandlers[ext].map(renderer => {
                                              const isSelected = preferences[ext] === renderer.id;
                                              return (
                                                <button
                                                    key={renderer.id}
                                                    onClick={() => handleSetPreference(ext, renderer.id)}
                                                    className={`
                                                        w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left group
                                                        ${isSelected 
                                                            ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                                                            : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`
                                                            p-2.5 rounded-lg border shadow-inner
                                                            ${isSelected 
                                                                ? 'bg-blue-500 text-white border-blue-400' 
                                                                : 'bg-zinc-800 text-zinc-400 border-zinc-700 group-hover:text-zinc-300'
                                                            }
                                                        `}>
                                                            {renderer.icon || <FileText className="w-5 h-5" />}
                                                        </div>
                                                        <div>
                                                            <div className={`text-sm font-medium ${isSelected ? 'text-blue-100' : 'text-zinc-300'}`}>
                                                                {renderer.label}
                                                            </div>
                                                            <div className="text-[11px] text-zinc-500 font-mono mt-0.5">ID: {renderer.id}</div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className={`
                                                        w-6 h-6 rounded-full border flex items-center justify-center transition-colors
                                                        ${isSelected 
                                                            ? 'bg-blue-500 border-blue-500' 
                                                            : 'border-zinc-700 bg-zinc-800'
                                                        }
                                                    `}>
                                                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                                    </div>
                                                </button>
                                              );
                                          })}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              )}
          </div>
      </div>
    </Modal>
  );
};