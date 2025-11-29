

import { FileSystemNode, FileType, Vault } from '../types';

/**
 * Interface for Storage Adapters.
 * Implement this interface to switch to a real file system (Electron/FileSystemAccessAPI) later.
 */
export interface IStorageAdapter {
  getVaults(): Promise<Vault[]>;
  createVault(name: string, path: string): Promise<Vault>;
  deleteVault(id: string): Promise<void>;
  
  loadTree(vaultId: string): Promise<FileSystemNode[]>;
  saveTree(vaultId: string, tree: FileSystemNode[]): Promise<void>;
  
  loadFileContent(fileId: string): Promise<any>;
  saveFileContent(fileId: string, content: any): Promise<void>;

  // Plugin Persistence
  getGlobalPluginIds(): Promise<string[]>;
  saveGlobalPluginIds(ids: string[]): Promise<void>;
  getWorkspacePluginIds(vaultId: string): Promise<string[]>;
  saveWorkspacePluginIds(vaultId: string, ids: string[]): Promise<void>;

  // Remote Plugin Persistence (Installed Code/Manifests)
  getInstalledRemotePlugins(): Promise<{id: string, code: string, manifestUrl: string}[]>;
  saveInstalledRemotePlugin(plugin: {id: string, code: string, manifestUrl: string}): Promise<void>;
  removeInstalledRemotePlugin(id: string): Promise<void>;

  // AI Dock Persistence
  getAIDockConfig(): Promise<{ url: string; name: string } | null>;
  saveAIDockConfig(config: { url: string; name: string } | null): Promise<void>;

  // User Preferences
  getPreference(key: string): Promise<string | null>;
  savePreference(key: string, value: string): Promise<void>;
}

/**
 * LocalStorage Implementation of the Storage Adapter.
 */
class LocalStorageAdapter implements IStorageAdapter {
  private VAULTS_KEY = 'focosx_vaults';
  private TREE_PREFIX = 'focosx_tree_';
  private CONTENT_PREFIX = 'focosx_content_';
  private GLOBAL_PLUGINS_KEY = 'focosx_global_plugins';
  private WORKSPACE_PLUGINS_PREFIX = 'focosx_workspace_plugins_';
  private REMOTE_PLUGINS_KEY = 'focosx_remote_plugins_source';
  private AI_DOCK_CONFIG_KEY = 'focosx_ai_dock_config';
  private PREFERENCES_KEY = 'focosx_preferences';

  async getVaults(): Promise<Vault[]> {
    const raw = localStorage.getItem(this.VAULTS_KEY);
    let vaults = raw ? JSON.parse(raw) : [];

    if (vaults.length === 0) {
        const defaultVault: Vault = {
            id: crypto.randomUUID(),
            name: 'Default Vault',
            path: 'Local Storage/',
            createdAt: Date.now()
        };
        vaults = [defaultVault];
        localStorage.setItem(this.VAULTS_KEY, JSON.stringify(vaults));
        
        // Initialize default tree for default vault
        await this.saveTree(defaultVault.id, ensureDefaultStructure([]));
    }

    return vaults;
  }

  async createVault(name: string, path: string): Promise<Vault> {
    const vaults = await this.getVaults();
    const newVault: Vault = {
      id: crypto.randomUUID(),
      name,
      path,
      createdAt: Date.now()
    };
    vaults.push(newVault);
    localStorage.setItem(this.VAULTS_KEY, JSON.stringify(vaults));
    
    // Initialize tree for new vault with default folders
    await this.saveTree(newVault.id, ensureDefaultStructure([])); 
    return newVault;
  }

  async deleteVault(id: string): Promise<void> {
    const vaults = await this.getVaults();
    const filtered = vaults.filter(v => v.id !== id);
    localStorage.setItem(this.VAULTS_KEY, JSON.stringify(filtered));
    
    // Cleanup tree data (In a real FS, this would delete the folder)
    localStorage.removeItem(this.TREE_PREFIX + id);
    // Cleanup workspace plugins
    localStorage.removeItem(this.WORKSPACE_PLUGINS_PREFIX + id);
  }

  async loadTree(vaultId: string): Promise<FileSystemNode[]> {
    const raw = localStorage.getItem(this.TREE_PREFIX + vaultId);
    return raw ? JSON.parse(raw) : [];
  }

  async saveTree(vaultId: string, tree: FileSystemNode[]): Promise<void> {
    localStorage.setItem(this.TREE_PREFIX + vaultId, JSON.stringify(tree));
  }

  async loadFileContent(fileId: string): Promise<any> {
    const raw = localStorage.getItem(this.CONTENT_PREFIX + fileId);
    // If no content found, return null or empty string/object depending on context
    // For canvases, we return a default structure if missing
    return raw ? JSON.parse(raw) : null;
  }

  async saveFileContent(fileId: string, content: any): Promise<void> {
    localStorage.setItem(this.CONTENT_PREFIX + fileId, JSON.stringify(content));
  }

  // --- Plugin Persistence Implementation ---

  async getGlobalPluginIds(): Promise<string[]> {
      const raw = localStorage.getItem(this.GLOBAL_PLUGINS_KEY);
      return raw ? JSON.parse(raw) : [];
  }

  async saveGlobalPluginIds(ids: string[]): Promise<void> {
      localStorage.setItem(this.GLOBAL_PLUGINS_KEY, JSON.stringify(ids));
  }

  async getWorkspacePluginIds(vaultId: string): Promise<string[]> {
      const raw = localStorage.getItem(this.WORKSPACE_PLUGINS_PREFIX + vaultId);
      return raw ? JSON.parse(raw) : [];
  }

  async saveWorkspacePluginIds(vaultId: string, ids: string[]): Promise<void> {
      localStorage.setItem(this.WORKSPACE_PLUGINS_PREFIX + vaultId, JSON.stringify(ids));
  }

  // --- Remote Plugins (Source Code) ---

  async getInstalledRemotePlugins(): Promise<{id: string, code: string, manifestUrl: string}[]> {
      const raw = localStorage.getItem(this.REMOTE_PLUGINS_KEY);
      return raw ? JSON.parse(raw) : [];
  }

  async saveInstalledRemotePlugin(plugin: {id: string, code: string, manifestUrl: string}): Promise<void> {
      const current = await this.getInstalledRemotePlugins();
      const existingIdx = current.findIndex(p => p.id === plugin.id);
      
      if (existingIdx >= 0) {
          current[existingIdx] = plugin;
      } else {
          current.push(plugin);
      }
      localStorage.setItem(this.REMOTE_PLUGINS_KEY, JSON.stringify(current));
  }

  async removeInstalledRemotePlugin(id: string): Promise<void> {
      const current = await this.getInstalledRemotePlugins();
      const filtered = current.filter(p => p.id !== id);
      localStorage.setItem(this.REMOTE_PLUGINS_KEY, JSON.stringify(filtered));
  }

  // --- AI Dock Persistence ---
  
  async getAIDockConfig(): Promise<{ url: string; name: string } | null> {
      const raw = localStorage.getItem(this.AI_DOCK_CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
  }

  async saveAIDockConfig(config: { url: string; name: string } | null): Promise<void> {
      if (config) {
        localStorage.setItem(this.AI_DOCK_CONFIG_KEY, JSON.stringify(config));
      } else {
        localStorage.removeItem(this.AI_DOCK_CONFIG_KEY);
      }
  }

  // --- Preferences ---
  
  private getPreferencesObject(): Record<string, string> {
      const raw = localStorage.getItem(this.PREFERENCES_KEY);
      return raw ? JSON.parse(raw) : {};
  }

  async getPreference(key: string): Promise<string | null> {
      const prefs = this.getPreferencesObject();
      return prefs[key] || null;
  }

  async savePreference(key: string, value: string): Promise<void> {
      const prefs = this.getPreferencesObject();
      prefs[key] = value;
      localStorage.setItem(this.PREFERENCES_KEY, JSON.stringify(prefs));
  }
}

// Singleton Instance
export const storage = new LocalStorageAdapter();

/**
 * Helper to initialize default assets folder if missing
 */
export const ensureDefaultStructure = (tree: FileSystemNode[]): FileSystemNode[] => {
  const defaults = ['Notes', 'Canvases', 'assets'];
  let newTree = [...tree];
  
  defaults.forEach(name => {
      const exists = newTree.find(n => n.name === name && n.type === FileType.FOLDER);
      if (!exists) {
          newTree.push({
              id: name === 'assets' ? 'assets-folder' : crypto.randomUUID(),
              name,
              type: FileType.FOLDER,
              parentId: null,
              children: []
          });
      }
  });

  // Add a default canvas file if no canvases exist
  const hasCanvas = newTree.some(n => n.type === FileType.CANVAS);
  if (!hasCanvas) {
      const canvasId = crypto.randomUUID();
      newTree.push({
          id: canvasId,
          name: 'Welcome.canvas',
          type: FileType.CANVAS,
          parentId: null, // Root
      });
      
      // Save default content for this canvas
      const defaultContent = {
          id: canvasId,
          name: 'Welcome',
          frames: [
              {
                  id: 'welcome-note',
                  type: 'sticky-note',
                  x: 100,
                  y: 100,
                  width: 300,
                  height: 200,
                  content: 'Welcome to FocosX!\n\nTry using the toolbar at the bottom to draw on the canvas or add new frames.',
                  strokes: []
              },
              {
                  id: 'example-image',
                  type: 'image',
                  x: 450,
                  y: 100,
                  width: 300,
                  height: 200,
                  content: '', // Empty content to show upload UI
                  strokes: []
              }
          ],
          globalStrokes: []
      };
      storage.saveFileContent(canvasId, defaultContent);
  }

  // Add a default CSV file if missing
  const hasCSV = newTree.some(n => n.name.endsWith('.csv'));
  if (!hasCSV) {
      const csvId = crypto.randomUUID();
      newTree.push({
          id: csvId,
          name: 'Data.csv',
          type: FileType.FILE,
          parentId: null, // Root
      });

      // Save default content
      const defaultCSVContent = "Name,Role,Department\nAlice,Engineer,Product\nBob,Designer,Product\nCharlie,Manager,Sales";
      storage.saveFileContent(csvId, defaultCSVContent);
  }
  
  return newTree;
};