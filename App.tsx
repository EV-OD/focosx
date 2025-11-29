

import React, { useState, useMemo, useEffect } from 'react';
import { FileExplorer } from './components/FileExplorer';
import { FileViewer } from './components/FileViewer';
import { WelcomeScreen } from './components/WelcomeScreen';
import { DocsViewer } from './components/Docs/DocsViewer';
import { CreateNodeModal } from './components/CreateNodeModal';
import { PluginStoreModal } from './components/PluginStore/PluginStoreModal';
import { SettingsModal } from './components/Settings/SettingsModal';
import { AIDock } from './components/AIDock';
import { FileSystemNode, FileType, CanvasData, Vault } from './types';
import { storage } from './services/StorageService';
import { useFileSystem } from './hooks/useFileSystem';
import { Search, Sidebar, ArrowLeft, ChevronRight, FolderOpen } from 'lucide-react';
import { PluginManager } from './plugins/PluginManager';

type AppView = 'workspace' | 'docs';

const App: React.FC = () => {
  const [currentVault, setCurrentVault] = useState<Vault | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('workspace');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isPluginStoreOpen, setIsPluginStoreOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // --- Modular File System Hook ---
  const { fileTree, createNode, deleteNode, getNode, updateTree } = useFileSystem(currentVault?.id || null);

  // --- Selection State ---
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeFileContent, setActiveFileContent] = useState<any>(null);
  
  // Derived active node
  const activeFile = useMemo(() => 
    activeFileId ? getNode(activeFileId) : null
  , [activeFileId, getNode, fileTree]);

  // --- Modal State ---
  const [createModal, setCreateModal] = useState<{
    isOpen: boolean;
    initialType: FileType;
    parentId: string | null;
    parentName: string;
  }>({ isOpen: false, initialType: FileType.FILE, parentId: null, parentName: 'Root' });

  // --- Handlers ---
  
  const handleOpenVault = async (vault: Vault) => {
    // Initialize Plugins for this specific vault (loads global + workspace specific)
    await PluginManager.initialize(vault.id);
    
    setCurrentVault(vault);
    setActiveFileId(null);
    setActiveFileContent(null);
  };

  const handleCloseVault = () => {
      setCurrentVault(null);
      setActiveFileId(null);
      setActiveFileContent(null);
      // Optional: Reset plugins to base state or keep last loaded
      PluginManager.initialize(null); 
  };

  const handleFileSelect = async (node: FileSystemNode) => {
    setActiveFileId(node.id);
    
    if (node.type === FileType.FOLDER) {
        setActiveFileContent(null);
        return;
    }

    const content = await storage.loadFileContent(node.id);
    
    if (node.type === FileType.CANVAS && !content) {
        const defaultCanvas: CanvasData = {
            id: node.id,
            name: node.name,
            frames: [],
            globalStrokes: []
        };
        setActiveFileContent(defaultCanvas);
    } else {
        setActiveFileContent(content === null ? '' : content); 
    }
  };

  const getTargetParent = () => {
      let parentId: string | null = null;
      let parentName = 'Root';

      if (activeFile) {
          if (activeFile.type === FileType.FOLDER) {
              parentId = activeFile.id;
              parentName = activeFile.name;
          } else {
              parentId = activeFile.parentId || null;
              if (parentId) {
                  const parent = getNode(parentId);
                  parentName = parent?.name || 'Unknown Folder';
              }
          }
      }
      return { parentId, parentName };
  };

  const initiateCreate = (preferredType: FileType) => {
      const { parentId, parentName } = getTargetParent();
      setCreateModal({
          isOpen: true,
          initialType: preferredType,
          parentId,
          parentName
      });
  };

  const handleCreateConfirm = async (name: string, type: FileType) => {
      const newNode = await createNode(name, type, createModal.parentId);
      if (newNode.type !== FileType.FOLDER) {
          handleFileSelect(newNode);
      }
  };

  const handleDeleteNode = async (nodeId: string) => {
      if (!window.confirm("Delete this item and all its contents?")) return;
      
      await deleteNode(nodeId);
      if (activeFileId === nodeId) {
          setActiveFileId(null);
          setActiveFileContent(null);
      }
  };

  const handleSaveContent = async (id: string, updatedData: any) => {
     if (activeFileId === id) {
         await storage.saveFileContent(id, updatedData);
         setActiveFileContent(updatedData);
     }
  };

  const handleUploadFile = async (file: File, explicitParentId: string | null) => {
      const parentId = explicitParentId || getTargetParent().parentId;
      
      const isCanvas = file.name.toLowerCase().endsWith('.canvas');
      // Automatically detect canvas files and assign correct type
      const type = isCanvas ? FileType.CANVAS : FileType.FILE;

      const newNode = await createNode(file.name, type, parentId);
      const reader = new FileReader();
      
      // Update regex to include .canvas as text/json
      const isText = file.name.match(/\.(txt|md|json|js|ts|tsx|html|css|py|csv|svg|canvas)$/i);
      
      reader.onload = async (e) => {
          let content = e.target?.result;
          if (content) {
             // If it is a canvas file, we must store it as a parsed object, not a string
             // so that the CanvasBoard receives a data object.
             if (isCanvas && typeof content === 'string') {
                 try {
                     content = JSON.parse(content);
                 } catch (err) {
                     console.error("Failed to parse canvas file", err);
                     alert("Invalid .canvas file format.");
                     return;
                 }
             }

             await storage.saveFileContent(newNode.id, content);
             handleFileSelect(newNode);
          }
      };

      if (isText) {
          reader.readAsText(file);
      } else {
          reader.readAsDataURL(file);
      }
  };

  // --- Views ---

  if (currentView === 'docs') {
      return <DocsViewer onClose={() => setCurrentView('workspace')} />;
  }

  if (!currentVault) {
      return (
          <WelcomeScreen 
              onOpenVault={handleOpenVault} 
              onOpenDocs={() => setCurrentView('docs')}
          />
      );
  }

  return (
    <div className="flex h-screen w-screen bg-background text-text font-sans overflow-hidden relative">
      {/* Sidebar */}
      <div 
        className={`
            flex flex-col border-r border-border bg-surface transition-all duration-300 ease-in-out relative z-30
            ${sidebarOpen ? 'w-64' : 'w-0 opacity-0 overflow-hidden border-none'}
        `}
      >
        <div className="h-12 flex items-center px-4 border-b border-border justify-between shrink-0">
            <div className="flex items-center gap-2 text-zinc-100 font-semibold truncate">
                <button 
                    onClick={handleCloseVault} 
                    className="p-1 -ml-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-100"
                    title="Back to Vaults"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="truncate">{currentVault.name}</span>
            </div>
            <div className="flex items-center gap-1">
                <button 
                    onClick={() => setSidebarOpen(false)}
                    className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors ml-1"
                    title="Collapse Sidebar"
                >
                    <Sidebar className="w-4 h-4" />
                </button>
            </div>
        </div>

        <div className="p-2 shrink-0">
            <div className="flex items-center gap-2 bg-zinc-800/50 p-2 rounded-md text-sm text-zinc-500 mb-2">
                <Search className="w-4 h-4" />
                <span>Search files...</span>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4 no-scrollbar">
            <div className="text-xs font-bold text-zinc-600 uppercase tracking-wider mb-2 mt-2 px-2">Explorer</div>
            <FileExplorer 
                nodes={fileTree} 
                onFileSelect={handleFileSelect} 
                selectedFileId={activeFileId} 
                onCreateFile={() => initiateCreate(FileType.CANVAS)}
                onCreateFolder={() => initiateCreate(FileType.FOLDER)}
                onDeleteNode={handleDeleteNode}
                onUploadFile={handleUploadFile}
                onOpenPluginStore={() => setIsPluginStoreOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
            />
        </div>
      </div>

      {/* Sidebar Toggle (Collapsed State) - Center Left */}
      {!sidebarOpen && (
          <button 
            onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-40 bg-zinc-800 border border-zinc-700 border-l-0 rounded-r-lg p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 shadow-lg transition-all hover:pl-2"
            title="Expand Sidebar"
          >
              <ChevronRight className="w-4 h-4" />
          </button>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-[#09090b] z-10">
         {/* Workspace */}
         {activeFile ? (
             <FileViewer 
                file={activeFile}
                content={activeFileContent}
                onSave={handleSaveContent}
                onOpenPluginStore={() => setIsPluginStoreOpen(true)}
             />
         ) : (
             // Empty State
             <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                 <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
                    <FolderOpen className="w-8 h-8 opacity-50" />
                 </div>
                 <p>Select a file to begin.</p>
             </div>
         )}
      </div>

      {/* AI Dock (Overlay) */}
      <div className="absolute inset-0 z-[60] pointer-events-none overflow-hidden">
        <AIDock />
      </div>

      {/* Modals */}
      <CreateNodeModal
        isOpen={createModal.isOpen}
        onClose={() => setCreateModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleCreateConfirm}
        initialType={createModal.initialType}
        parentName={createModal.parentName}
      />

      {/* Global Plugin Store Overlay */}
      <PluginStoreModal 
          isOpen={isPluginStoreOpen}
          onClose={() => setIsPluginStoreOpen(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default App;