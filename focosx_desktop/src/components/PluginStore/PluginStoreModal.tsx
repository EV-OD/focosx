

import React, { useState, useEffect } from 'react';
import { PluginManager, OPTIONAL_PLUGINS_CATALOG } from '../../plugins/PluginManager';
import { RemotePluginService, RemotePluginManifest } from '../../services/RemotePluginService';
import { PluginDefinition } from '../../plugins/api/types';
import { Box, Puzzle, CheckCircle, Grid, List, Search, X, Monitor, FileCode, Settings, Info, ArrowRight, Trash2, Globe, Layout, Download, Cloud, RefreshCw, Loader2 } from 'lucide-react';

interface PluginStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'all' | 'canvas' | 'editors' | 'remote';

export const PluginStoreModal: React.FC<PluginStoreModalProps> = ({ isOpen, onClose }) => {
  // State for Installed Plugins (Active)
  const [installedPlugins, setInstalledPlugins] = useState<PluginDefinition[]>([]);
  
  // State for Remote Listing
  const [remoteListing, setRemoteListing] = useState<RemotePluginManifest[]>([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Unified Selection State: Can be a PluginDefinition (Installed/Bundled) OR a RemoteManifest (Not installed yet)
  const [selectedItem, setSelectedItem] = useState<{ def?: PluginDefinition, manifest?: RemotePluginManifest } | null>(null);

  // Initial Load
  useEffect(() => {
    const update = () => {
        setInstalledPlugins(PluginManager.getAllActivePlugins());
    };
    if (isOpen) {
        update();
        fetchRemoteListing();
        document.body.style.overflow = 'hidden';
    }
    const unsubscribe = PluginManager.subscribe(update);
    return () => {
        unsubscribe();
        document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const fetchRemoteListing = async () => {
      setIsLoadingRemote(true);
      try {
          const listing = await RemotePluginService.getPluginListing();
          setRemoteListing(listing);
      } catch (e) {
          console.error("Failed to load store listing");
      } finally {
          setIsLoadingRemote(false);
      }
  };

  const handleInstall = async (item: { def?: PluginDefinition, manifest?: RemotePluginManifest }, scope: 'global' | 'workspace') => {
      if (item.def) {
          // Bundled or Already Loaded
          await PluginManager.installPlugin(item.def.id, scope);
      } else if (item.manifest) {
          // Remote Install
          setInstallingId(item.manifest.id);
          await PluginManager.installRemotePlugin(item.manifest, scope);
          setInstallingId(null);
      }
  };

  const handleUninstall = async (id: string, scope: 'global' | 'workspace') => {
      if (id.startsWith('core-')) {
          alert("Core plugins cannot be removed.");
          return;
      }
      await PluginManager.uninstallPlugin(id, scope);
  };

  const getStatus = (id: string) => PluginManager.isInstalled(id);

  // --- Display Logic ---

  // 1. Create a unified list of display items
  const displayItems: Array<{ 
      id: string; 
      name: string; 
      description?: string; 
      version: string;
      author?: string;
      isCore: boolean;
      def?: PluginDefinition; 
      manifest?: RemotePluginManifest;
      tags: string[];
  }> = [];

  // Add Installed / Bundled
  const processedIds = new Set<string>();

  // Add Core & Bundled & Loaded Remote from Manager
  const activeAndBundled = [
      ...installedPlugins,
      ...OPTIONAL_PLUGINS_CATALOG
  ];

  activeAndBundled.forEach(p => {
      if (processedIds.has(p.id)) return;
      displayItems.push({
          id: p.id,
          name: p.name,
          description: p.description,
          version: p.version,
          author: p.author,
          isCore: p.id.startsWith('core-'),
          def: p,
          tags: p.frameTypes ? ['widget'] : p.fileRenderers ? ['editor'] : []
      });
      processedIds.add(p.id);
  });

  // Add Remote Manifests (if not already processed/installed)
  remoteListing.forEach(m => {
      if (processedIds.has(m.id)) return;
      displayItems.push({
          id: m.id,
          name: m.name,
          description: m.description,
          version: m.version,
          author: m.author,
          isCore: false,
          manifest: m,
          tags: m.tags || []
      });
  });

  // Filter
  const filteredItems = displayItems.filter(item => {
      let matchesTab = true;
      if (activeTab === 'canvas') {
          // Check def for frameTypes OR manifest tags
          matchesTab = (item.def?.frameTypes && Object.keys(item.def.frameTypes).length > 0) || (item.tags.includes('widget')) || false;
      } else if (activeTab === 'editors') {
          matchesTab = (item.def?.fileRenderers && Object.keys(item.def.fileRenderers).length > 0) || (item.tags.includes('editor')) || false;
      }

      let matchesSearch = true;
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          matchesSearch = item.name.toLowerCase().includes(q) || (item.description?.toLowerCase().includes(q) ?? false);
      }
      return matchesTab && matchesSearch;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#09090b] border border-zinc-800 w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
          
          {/* Header */}
          <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 shrink-0">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                      <Puzzle className="w-6 h-6" />
                  </div>
                  <div>
                      <h2 className="text-lg font-bold text-zinc-100">Extension Marketplace</h2>
                      <p className="text-xs text-zinc-500">Discover and manage plugins</p>
                  </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
              </button>
          </div>

          <div className="flex flex-1 min-h-0">
              {/* Sidebar */}
              <div className="w-64 border-r border-zinc-800 bg-[#121214] flex flex-col shrink-0 p-4">
                  <div className="relative mb-6">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input 
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-all"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                      />
                  </div>

                  <div className="space-y-1">
                      <h3 className="px-3 text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Filters</h3>
                      <button 
                        onClick={() => setActiveTab('all')}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                      >
                          <Grid className="w-4 h-4" />
                          All Extensions
                      </button>
                      <button 
                        onClick={() => setActiveTab('canvas')}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'canvas' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                      >
                          <Monitor className="w-4 h-4" />
                          Canvas Widgets
                      </button>
                      <button 
                        onClick={() => setActiveTab('editors')}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === 'editors' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                      >
                          <FileCode className="w-4 h-4" />
                          File Editors
                      </button>
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-zinc-800 space-y-2">
                       <button 
                          onClick={fetchRemoteListing}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-xs text-zinc-400 transition-colors"
                          disabled={isLoadingRemote}
                       >
                           {isLoadingRemote ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                           Refresh Remote List
                       </button>

                      <div className="px-3 py-2 bg-zinc-900/50 rounded border border-zinc-800/50 flex justify-between items-center">
                          <div>
                            <div className="text-xs text-zinc-500 mb-1">Active Plugins</div>
                            <div className="text-2xl font-bold text-zinc-300">{installedPlugins.length}</div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Main Grid */}
              <div className="flex-1 overflow-y-auto p-6 bg-[#09090b]">
                  {isLoadingRemote && filteredItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                          <p>Fetching plugins...</p>
                      </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredItems.map(item => {
                            const status = getStatus(item.id);
                            const isInstalling = installingId === item.id;
                            const hasWidgets = item.tags.includes('widget') || (item.def?.frameTypes && Object.keys(item.def.frameTypes).length > 0);
                            const hasEditors = item.tags.includes('editor') || (item.def?.fileRenderers && Object.keys(item.def.fileRenderers).length > 0);
                            const isInstalled = item.isCore || status.global || status.workspace;

                            // Badge Logic
                            let badge = null;
                            if (item.isCore) {
                                badge = <span className="px-2 py-1 bg-zinc-800 text-zinc-500 text-[10px] font-bold uppercase tracking-wider rounded border border-zinc-700">Built-in</span>;
                            } else if (status.global) {
                                badge = <span className="px-2 py-1 bg-green-900/20 text-green-500 text-[10px] font-bold uppercase tracking-wider rounded border border-green-900/30 flex items-center gap-1"><Globe className="w-3 h-3"/> Global</span>;
                            } else if (status.workspace) {
                                badge = <span className="px-2 py-1 bg-blue-900/20 text-blue-500 text-[10px] font-bold uppercase tracking-wider rounded border border-blue-900/30 flex items-center gap-1"><Layout className="w-3 h-3"/> Workspace</span>;
                            } else if (!item.def) {
                                // Is Remote and not installed
                                badge = <span className="px-2 py-1 bg-purple-900/20 text-purple-400 text-[10px] font-bold uppercase tracking-wider rounded border border-purple-900/30 flex items-center gap-1"><Cloud className="w-3 h-3"/> Remote</span>;
                            }

                            return (
                                <div 
                                    key={item.id}
                                    onClick={() => setSelectedItem(item)}
                                    className={`group relative bg-[#121214] border rounded-xl p-5 flex flex-col cursor-pointer transition-all hover:shadow-xl hover:-translate-y-0.5 ${selectedItem?.def?.id === item.id || selectedItem?.manifest?.id === item.id ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-zinc-800 hover:border-zinc-700'}`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center border border-zinc-700 shadow-inner">
                                            {hasEditors ? <FileCode className="w-6 h-6 text-purple-400" /> : <Box className="w-6 h-6 text-blue-400" />}
                                        </div>
                                        {badge}
                                    </div>
                                    
                                    <h3 className="font-bold text-zinc-100 text-lg mb-1 group-hover:text-blue-400 transition-colors">{item.name}</h3>
                                    <p className="text-xs text-zinc-500 line-clamp-2 mb-4 flex-1">{item.description}</p>
                                    
                                    <div className="flex items-center gap-2 mb-4">
                                        {hasWidgets && <span className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-1 rounded">Widget</span>}
                                        {hasEditors && <span className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-1 rounded">Editor</span>}
                                        <span className="text-[10px] text-zinc-600 ml-auto">v{item.version}</span>
                                    </div>

                                    <div className="mt-auto">
                                        <button className={`w-full py-2 rounded-lg text-xs font-medium border transition-colors flex items-center justify-center gap-2 ${
                                            isInstalling ? 'bg-blue-600/20 text-blue-400 border-blue-600/30' : 
                                            isInstalled ? 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20' :
                                            'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 border-zinc-800'
                                        }`}>
                                            {isInstalling ? (
                                                <>
                                                    <Loader2 className="w-3 h-3 animate-spin" /> Installing...
                                                </>
                                            ) : isInstalled ? (
                                                <>
                                                    <CheckCircle className="w-3 h-3" /> Installed
                                                </>
                                            ) : (
                                                'View Details'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                  )}
              </div>
          </div>

          {/* Details Panel */}
          {selectedItem && (
              <div className="absolute top-0 bottom-0 right-0 w-96 bg-[#18181b] border-l border-zinc-800 shadow-2xl animate-in slide-in-from-right duration-300 z-10 flex flex-col">
                  {(() => {
                      const id = selectedItem.def?.id || selectedItem.manifest?.id!;
                      const name = selectedItem.def?.name || selectedItem.manifest?.name!;
                      const description = selectedItem.def?.description || selectedItem.manifest?.description;
                      const author = selectedItem.def?.author || selectedItem.manifest?.author;
                      
                      const status = getStatus(id);
                      const isCore = id.startsWith('core-');
                      const isInstalling = installingId === id;

                      return (
                      <>
                        <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 shrink-0 bg-zinc-900/50">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Details</span>
                            <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-700 shadow-lg">
                                    <Box className="w-8 h-8 text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{name}</h2>
                                    <div className="text-xs text-zinc-500 mt-1">by {author || 'Community'}</div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">About</h4>
                                    <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                                        {description || "No description provided."}
                                    </p>
                                </div>

                                {/* Install / Uninstall Actions */}
                                <div>
                                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Management</h4>
                                    
                                    {isCore ? (
                                         <div className="w-full py-3 rounded-xl bg-zinc-800/50 text-zinc-500 border border-zinc-800 text-center text-sm">
                                             This is a built-in system extension.
                                         </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {/* Global Action */}
                                            {status.global ? (
                                                <button 
                                                    onClick={() => handleUninstall(id, 'global')}
                                                    className="w-full py-2.5 rounded-lg bg-zinc-800 hover:bg-red-900/20 text-zinc-300 hover:text-red-400 border border-zinc-700 hover:border-red-900/50 transition-all text-xs font-medium flex items-center justify-center gap-2"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    Uninstall from Global
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => handleInstall(selectedItem, 'global')}
                                                    disabled={isInstalling}
                                                    className="w-full py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 border border-transparent transition-all text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-white/5 disabled:opacity-50"
                                                >
                                                    {isInstalling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                                                    {selectedItem.manifest && !selectedItem.def ? 'Download & Install Globally' : 'Add Globally'}
                                                </button>
                                            )}

                                            {/* Workspace Action */}
                                            {status.workspace ? (
                                                <button 
                                                    onClick={() => handleUninstall(id, 'workspace')}
                                                    className="w-full py-2.5 rounded-lg bg-zinc-800 hover:bg-red-900/20 text-zinc-300 hover:text-red-400 border border-zinc-700 hover:border-red-900/50 transition-all text-xs font-medium flex items-center justify-center gap-2"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    Uninstall from Workspace
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => handleInstall(selectedItem, 'workspace')}
                                                    disabled={isInstalling}
                                                    className={`w-full py-2.5 rounded-lg border transition-all text-xs font-bold flex items-center justify-center gap-2 ${status.global ? 'border-zinc-700 text-zinc-500 hover:text-zinc-300' : 'border-blue-500/50 text-blue-400 hover:bg-blue-500/10'}`}
                                                >
                                                    {isInstalling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Layout className="w-3 h-3" />}
                                                    {status.global ? 'Add to Workspace (Redundant)' : 'Add to Workspace Only'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="border-t border-zinc-800 pt-6">
                                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Capabilities</h4>
                                    <div className="space-y-2">
                                        {/* Since we might only have manifest, we guess capabilities based on tags if def missing */}
                                        {selectedItem.def?.frameTypes && Object.values(selectedItem.def.frameTypes).map((ft: any) => (
                                            <div key={ft.label} className="flex items-center gap-3 text-sm text-zinc-400 bg-zinc-900/30 p-2 rounded border border-zinc-800/50">
                                                <div className="p-1 bg-zinc-800 rounded text-zinc-300">{ft.icon}</div>
                                                <span>Adds <strong>{ft.label}</strong> Widget</span>
                                            </div>
                                        ))}
                                        {selectedItem.manifest?.tags.includes('widget') && !selectedItem.def && (
                                             <div className="flex items-center gap-3 text-sm text-zinc-400 bg-zinc-900/30 p-2 rounded border border-zinc-800/50">
                                                <div className="p-1 bg-zinc-800 rounded text-zinc-300"><Box className="w-4 h-4" /></div>
                                                <span>Adds Custom Widgets</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                      </>
                    )})()}
              </div>
          )}
      </div>
    </div>
  );
};
