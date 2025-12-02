import React, { useState, useEffect } from 'react';
import { Vault } from '../types';
import { storage } from '../services/StorageService';
import { Layout, Plus, Trash2, FolderOpen, Box, Folder, Book } from 'lucide-react';
import { Modal } from './Modal';

interface WelcomeScreenProps {
  onOpenVault: (vault: Vault) => void;
  onOpenDocs: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onOpenVault, onOpenDocs }) => {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultPath, setNewVaultPath] = useState('Local Storage/');
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    // Desktop-only app: always enable Tauri features immediately.
    setIsTauri(true);
    loadVaults();
  }, []);

  const loadVaults = async () => {
    const list = await storage.getVaults();
    setVaults(list);
  };

  const openCreateModal = () => {
    setNewVaultName('');
    setNewVaultPath('Local Storage/');
    setIsModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVaultName.trim()) return;
    // If running under desktop and a filesystem path was selected, persist it
    if (isTauri && newVaultPath && newVaultPath !== 'Local Storage/') {
      try {
        await storage.setVaultRootPath(newVaultPath);
      } catch (e) {
        console.warn('failed to set vault root path', e);
      }
    }

    // Create with path
    const vault = await storage.createVault(newVaultName, newVaultPath);
    
    setVaults([...vaults, vault]);
    setIsModalOpen(false);
    onOpenVault(vault);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this vault? This action cannot be undone.')) {
      await storage.deleteVault(id);
      loadVaults();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-text p-8 relative">
      {/* Top Right Actions */}
      <div className="absolute top-6 right-6 flex gap-3">
          <button 
             onClick={onOpenDocs}
             className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 text-sm text-zinc-400 hover:text-white transition-all"
          >
             <Book className="w-4 h-4" />
             <span>Developer Docs</span>
          </button>
      </div>

      <div className="max-w-md w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-800 rounded-2xl mb-6 shadow-2xl border border-zinc-700">
            <Layout className="w-8 h-8 text-zinc-100" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">FocosX</h1>
          <p className="text-zinc-500">Select a vault to begin your study session.</p>
        </div>

        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-lg min-h-[300px] flex flex-col">
          <div className="p-4 border-b border-border bg-zinc-900/50 flex items-center justify-between">
             <span className="text-sm font-medium text-zinc-400">Your Vaults</span>
             <button 
                onClick={openCreateModal}
                className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                title="New Vault"
             >
               <Plus className="w-4 h-4" />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {vaults.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 py-12">
                <Box className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm">No vaults found.</p>
                <button 
                    onClick={openCreateModal}
                    className="mt-4 text-xs text-blue-400 hover:underline"
                >
                    Create your first vault
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {vaults.map(vault => (
                  <div 
                    key={vault.id}
                    onClick={() => onOpenVault(vault)}
                    className="group flex items-center justify-between p-3 rounded-lg hover:bg-zinc-800 cursor-pointer transition-colors border border-transparent hover:border-zinc-700"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FolderOpen className="w-5 h-5 text-blue-500/80" />
                      <div className="flex flex-col truncate">
                          <span className="text-sm font-medium text-zinc-200 truncate">{vault.name}</span>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                             <span className="truncate max-w-[100px]">{vault.path}</span>
                             <span>•</span>
                             <span>{new Date(vault.createdAt).toLocaleDateString()}</span>
                          </div>
                      </div>
                    </div>
                    <button 
                        onClick={(e) => handleDelete(e, vault.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-zinc-600 hover:text-red-400 transition-all"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <p className="mt-8 text-center text-xs text-zinc-700">
          {isTauri
            ? 'Files will be persisted to the selected filesystem paths on your computer.'
            : 'Files are stored locally in your browser.'}
        </p>
      </div>

      {/* Create Vault Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Vault"
        footer={
            <>
                <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-md text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleCreate}
                    className="px-4 py-2 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium shadow-lg shadow-blue-900/20"
                >
                    Create Vault
                </button>
            </>
        }
      >
         <form id="create-vault-form" onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Vault Name</label>
                <input 
                    autoFocus
                    type="text" 
                    placeholder="e.g., Neuroscience Research" 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder-zinc-700"
                    value={newVaultName}
                    onChange={(e) => setNewVaultName(e.target.value)}
                />
            </div>
            
            <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Location</label>
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                             <Folder className="w-4 h-4 text-zinc-600" />
                        </div>
                        <input
                          type="text"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-400 focus:outline-none focus:border-zinc-700 transition-all"
                          value={newVaultPath}
                          onChange={(e) => setNewVaultPath(e.target.value)}
                        />
                    </div>
                    <button
                      type="button"
                      className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                      title="Browse..."
                      onClick={async () => {
                        if (!isTauri) {
                          alert("In the web version, files are securely stored in your browser's local storage.");
                          return;
                        }
                        try {
                          const mod = await import(/* @vite-ignore */ '@tauri-apps/plugin-dialog');
                          const selected = await mod.open({ directory: true, multiple: false });
                          if (Array.isArray(selected)) {
                            if (selected.length > 0) setNewVaultPath(String(selected[0]));
                          } else if (selected) {
                            setNewVaultPath(String(selected));
                          }
                        } catch (e) {
                          console.error('folder pick failed', e);
                          alert('Unable to open folder picker.');
                        }
                      }}
                    >
                      Browse
                    </button>
                </div>
                <p className="text-[10px] text-zinc-600">
                  {isTauri
                    ? 'Selected path will be used to persist this vault on your filesystem.'
                    : 'Path management is simulated in this web demo.'}
                </p>
            </div>
         </form>
      </Modal>
    </div>
  );
};