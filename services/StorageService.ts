import { FileSystemNode, FileType, Vault } from "../types";
import { waitForTauri } from "../hooks/useTauri";

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
  getInstalledRemotePlugins(): Promise<
    { id: string; code: string; manifestUrl: string }[]
  >;
  saveInstalledRemotePlugin(plugin: {
    id: string;
    code: string;
    manifestUrl: string;
  }): Promise<void>;
  removeInstalledRemotePlugin(id: string): Promise<void>;

  // AI Dock Persistence
  getAIDockConfig(): Promise<{ url: string; name: string } | null>;
  saveAIDockConfig(config: { url: string; name: string } | null): Promise<void>;

  // User Preferences
  getPreference(key: string): Promise<string | null>;
  savePreference(key: string, value: string): Promise<void>;
  // Vault filesystem root path (optional). When set, Rust/Tauri will persist
  // vaults under this path. If null, adapter keeps existing behaviour.
  getVaultRootPath(): Promise<string | null>;
  setVaultRootPath(path: string | null): Promise<void>;
}

/**
 * LocalStorage Implementation of the Storage Adapter.
 */
class LocalStorageAdapter implements IStorageAdapter {
  private VAULTS_KEY = "focosx_vaults";
  private TREE_PREFIX = "focosx_tree_";
  private CONTENT_PREFIX = "focosx_content_";
  private GLOBAL_PLUGINS_KEY = "focosx_global_plugins";
  private WORKSPACE_PLUGINS_PREFIX = "focosx_workspace_plugins_";
  private REMOTE_PLUGINS_KEY = "focosx_remote_plugins_source";
  private AI_DOCK_CONFIG_KEY = "focosx_ai_dock_config";
  private PREFERENCES_KEY = "focosx_preferences";
  private VAULT_ROOT_KEY = "focosx_vault_root_path";
  private VAULT_ROOT_KEY = "focosx_vault_root_path";

  async getVaults(): Promise<Vault[]> {
    const raw = localStorage.getItem(this.VAULTS_KEY);
    let vaults = raw ? JSON.parse(raw) : [];

    if (vaults.length === 0) {
      const defaultVault: Vault = {
        id: crypto.randomUUID(),
        name: "Default Vault",
        path: "Local Storage/",
        createdAt: Date.now(),
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
      createdAt: Date.now(),
    };
    vaults.push(newVault);
    localStorage.setItem(this.VAULTS_KEY, JSON.stringify(vaults));

    // Initialize tree for new vault with default folders
    await this.saveTree(newVault.id, ensureDefaultStructure([]));
    return newVault;
  }

  async deleteVault(id: string): Promise<void> {
    const vaults = await this.getVaults();
    const filtered = vaults.filter((v) => v.id !== id);
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
    localStorage.setItem(
      this.WORKSPACE_PLUGINS_PREFIX + vaultId,
      JSON.stringify(ids),
    );
  }

  // --- Remote Plugins (Source Code) ---

  async getInstalledRemotePlugins(): Promise<
    { id: string; code: string; manifestUrl: string }[]
  > {
    const raw = localStorage.getItem(this.REMOTE_PLUGINS_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  async saveInstalledRemotePlugin(plugin: {
    id: string;
    code: string;
    manifestUrl: string;
  }): Promise<void> {
    const current = await this.getInstalledRemotePlugins();
    const existingIdx = current.findIndex((p) => p.id === plugin.id);

    if (existingIdx >= 0) {
      current[existingIdx] = plugin;
    } else {
      current.push(plugin);
    }
    localStorage.setItem(this.REMOTE_PLUGINS_KEY, JSON.stringify(current));
  }

  async removeInstalledRemotePlugin(id: string): Promise<void> {
    const current = await this.getInstalledRemotePlugins();
    const filtered = current.filter((p) => p.id !== id);
    localStorage.setItem(this.REMOTE_PLUGINS_KEY, JSON.stringify(filtered));
  }

  // --- AI Dock Persistence ---

  async getAIDockConfig(): Promise<{ url: string; name: string } | null> {
    const raw = localStorage.getItem(this.AI_DOCK_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  async saveAIDockConfig(
    config: { url: string; name: string } | null,
  ): Promise<void> {
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

  async getVaultRootPath(): Promise<string | null> {
    const raw = localStorage.getItem(this.VAULT_ROOT_KEY);
    return raw && raw.length ? raw : null;
  }
  async setVaultRootPath(path: string | null): Promise<void> {
    if (path === null) localStorage.removeItem(this.VAULT_ROOT_KEY);
    else localStorage.setItem(this.VAULT_ROOT_KEY, path);
  }
}

// Singleton Instance
// Behavior:
// - Start with a lightweight in-memory adapter (no localStorage writes).
// - Poll briefly for the Tauri runtime (window.__TAURI__). If detected, switch
//   to a Tauri-backed adapter and migrate any legacy localStorage keys into the
//   Rust-managed filesystem.
// - If Tauri is not detected within TIMEOUT_MS, fall back to the original
//   LocalStorageAdapter to preserve the previous web behavior.
//
// Export a proxied adapter instance so other modules can import `storage` and
// continue using the same API while the underlying storage engine may switch.
class InMemoryAdapter implements IStorageAdapter {
  private store = new Map<string, string>();
  private VAULTS_KEY = "focosx_vaults";
  private TREE_PREFIX = "focosx_tree_";
  private CONTENT_PREFIX = "focosx_content_";
  private GLOBAL_PLUGINS_KEY = "focosx_global_plugins";
  private WORKSPACE_PLUGINS_PREFIX = "focosx_workspace_plugins_";
  private REMOTE_PLUGINS_KEY = "focosx_remote_plugins_source";
  private AI_DOCK_CONFIG_KEY = "focosx_ai_dock_config";
  private PREFERENCES_KEY = "focosx_preferences";

  private read(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  private write(key: string, value: string | null) {
    if (value === null || value === undefined) this.store.delete(key);
    else this.store.set(key, value);
  }
  async getVaultRootPath(): Promise<string | null> {
    const raw = this.read(this.VAULT_ROOT_KEY);
    return raw && raw.length ? raw : null;
  }
  async setVaultRootPath(path: string | null): Promise<void> {
    if (!path) this.write(this.VAULT_ROOT_KEY, null);
    else this.write(this.VAULT_ROOT_KEY, path);
  }

  async getVaults(): Promise<Vault[]> {
    const raw = this.read(this.VAULTS_KEY);
    if (!raw) {
      const defaultVault: Vault = {
        id: crypto.randomUUID(),
        name: "Default Vault",
        path: "Local Filesystem/",
        createdAt: Date.now(),
      };
      const s = JSON.stringify([defaultVault], null, 2);
      this.write(this.VAULTS_KEY, s);
      // initialize default tree
      this.write(
        `${this.TREE_PREFIX}${defaultVault.id}`,
        JSON.stringify(ensureDefaultStructure([])),
      );
      return [defaultVault];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async createVault(name: string, path: string): Promise<Vault> {
    const raw = this.read(this.VAULTS_KEY);
    const arr = raw && raw.length ? JSON.parse(raw) : [];
    const newVault: Vault = {
      id: crypto.randomUUID(),
      name,
      path,
      createdAt: Date.now(),
    };
    arr.push(newVault);
    this.write(this.VAULTS_KEY, JSON.stringify(arr));
    this.write(
      `${this.TREE_PREFIX}${newVault.id}`,
      JSON.stringify(ensureDefaultStructure([])),
    );
    return newVault;
  }

  async deleteVault(id: string): Promise<void> {
    const raw = this.read(this.VAULTS_KEY);
    const arr = raw && raw.length ? JSON.parse(raw) : [];
    const filtered = arr.filter((v: any) => v.id !== id);
    this.write(this.VAULTS_KEY, JSON.stringify(filtered));
    this.write(`${this.TREE_PREFIX}${id}`, null);
    this.write(`${this.WORKSPACE_PLUGINS_PREFIX}${id}`, null);
  }

  async loadTree(vaultId: string): Promise<FileSystemNode[]> {
    const raw = this.read(`${this.TREE_PREFIX}${vaultId}`);
    return raw ? JSON.parse(raw) : [];
  }
  async saveTree(vaultId: string, tree: FileSystemNode[]): Promise<void> {
    this.write(`${this.TREE_PREFIX}${vaultId}`, JSON.stringify(tree));
  }

  async loadFileContent(fileId: string): Promise<any> {
    const raw = this.read(`${this.CONTENT_PREFIX}${fileId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  async saveFileContent(fileId: string, content: any): Promise<void> {
    const payload =
      typeof content === "string" ? content : JSON.stringify(content);
    this.write(`${this.CONTENT_PREFIX}${fileId}`, payload);
  }

  async getGlobalPluginIds(): Promise<string[]> {
    const raw = this.read(this.GLOBAL_PLUGINS_KEY);
    return raw && raw.length ? JSON.parse(raw) : [];
  }
  async saveGlobalPluginIds(ids: string[]): Promise<void> {
    this.write(this.GLOBAL_PLUGINS_KEY, JSON.stringify(ids));
  }
  async getWorkspacePluginIds(vaultId: string): Promise<string[]> {
    const raw = this.read(`${this.WORKSPACE_PLUGINS_PREFIX}${vaultId}`);
    return raw && raw.length ? JSON.parse(raw) : [];
  }
  async saveWorkspacePluginIds(vaultId: string, ids: string[]): Promise<void> {
    this.write(
      `${this.WORKSPACE_PLUGINS_PREFIX}${vaultId}`,
      JSON.stringify(ids),
    );
  }

  async getInstalledRemotePlugins(): Promise<
    { id: string; code: string; manifestUrl: string }[]
  > {
    const raw = this.read(this.REMOTE_PLUGINS_KEY);
    return raw && raw.length ? JSON.parse(raw) : [];
  }
  async saveInstalledRemotePlugin(plugin: {
    id: string;
    code: string;
    manifestUrl: string;
  }): Promise<void> {
    const raw = this.read(this.REMOTE_PLUGINS_KEY);
    const arr = raw && raw.length ? JSON.parse(raw) : [];
    const idx = arr.findIndex((p: any) => p.id === plugin.id);
    if (idx >= 0) arr[idx] = plugin;
    else arr.push(plugin);
    this.write(this.REMOTE_PLUGINS_KEY, JSON.stringify(arr));
  }
  async removeInstalledRemotePlugin(id: string): Promise<void> {
    const raw = this.read(this.REMOTE_PLUGINS_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw).filter((p: any) => p.id !== id);
    this.write(this.REMOTE_PLUGINS_KEY, JSON.stringify(arr));
  }

  async getAIDockConfig(): Promise<{ url: string; name: string } | null> {
    const raw = this.read(this.AI_DOCK_CONFIG_KEY);
    return raw && raw.length ? JSON.parse(raw) : null;
  }
  async saveAIDockConfig(
    config: { url: string; name: string } | null,
  ): Promise<void> {
    if (config) this.write(this.AI_DOCK_CONFIG_KEY, JSON.stringify(config));
    else this.write(this.AI_DOCK_CONFIG_KEY, "");
  }

  private getPreferencesObject(): Record<string, string> {
    const raw = this.read(this.PREFERENCES_KEY);
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  async getPreference(key: string): Promise<string | null> {
    const prefs = this.getPreferencesObject();
    return prefs[key] || null;
  }
  async savePreference(key: string, value: string): Promise<void> {
    const prefs = this.getPreferencesObject();
    prefs[key] = value;
    this.write(this.PREFERENCES_KEY, JSON.stringify(prefs));
  }
}

/* -------------------------------------------------------------------------- */
/*                             File-backed adapter                             */
/* -------------------------------------------------------------------------- */
class FileAdapterV2 implements IStorageAdapter {
  private cache = new Map<string, string>();
  private VAULTS_KEY = "focosx_vaults";
  private TREE_PREFIX = "focosx_tree_";
  private CONTENT_PREFIX = "focosx_content_";
  private GLOBAL_PLUGINS_KEY = "focosx_global_plugins";
  private WORKSPACE_PLUGINS_PREFIX = "focosx_workspace_plugins_";
  private REMOTE_PLUGINS_KEY = "focosx_remote_plugins_source";
  private AI_DOCK_CONFIG_KEY = "focosx_ai_dock_config";
  private PREFERENCES_KEY = "focosx_preferences";
  private VAULT_ROOT_KEY = "focosx_vault_root_path";

  private read(key: string): string | null {
    return this.cache.has(key) ? (this.cache.get(key) as string) : null;
  }
  private write(key: string, value: string | null) {
    if (value === null || value === undefined) this.cache.delete(key);
    else this.cache.set(key, value);
  }

  private async getInvoke(): Promise<(cmd: string, payload?: any) => Promise<any>> {
    const mod = await import(/* @vite-ignore */ "@tauri-apps/api/tauri");
    const invoke = (mod.invoke ?? (mod.default && mod.default.invoke)) as (
      cmd: string,
      payload?: any,
    ) => Promise<any>;
    // ping probe
    const res = await invoke('ping');
    if (res === 'pong') return invoke;
    throw new Error('tauri invoke not responding');
  }

  async getVaults(): Promise<Vault[]> {
    try {
      const invoke = await this.getInvoke();
      const raw = await invoke('get_vaults');
      const s = raw || '[]';
      const arr = JSON.parse(s);
      this.write(this.VAULTS_KEY, JSON.stringify(arr));
      return arr;
    } catch {
      const raw = this.read(this.VAULTS_KEY);
      if (!raw) {
        const defaultVault: Vault = { id: crypto.randomUUID(), name: 'Default Vault', path: 'Local Filesystem/', createdAt: Date.now() };
        const s = JSON.stringify([defaultVault], null, 2);
        this.write(this.VAULTS_KEY, s);
        this.write(`${this.TREE_PREFIX}${defaultVault.id}`, JSON.stringify(ensureDefaultStructure([])));
        return [defaultVault];
      }
      try { return JSON.parse(raw); } catch { return []; }
    }
  }

  async createVault(name: string, path: string): Promise<Vault> {
    try {
      const invoke = await this.getInvoke();
      const isAbsolute = (p: string) => {
        if (!p) return false;
        if (p.startsWith('/')) return true;
        if (/^[A-Za-z]:[\\/]/.test(p)) return true;
        if (p.startsWith('\\\\')) return true;
        return false;
      };
      if (isAbsolute(path)) {
        const id = await invoke('create_vault_at_path', { name, path });
        await invoke('save_tree', { vault_id: id, json: JSON.stringify(ensureDefaultStructure([])) });
        const raw = await invoke('get_vaults');
        const arr = raw && raw.length ? JSON.parse(raw) : [];
        const found = arr.find((v: any) => v.id === id);
        if (found) return found as Vault;
        return { id, name, path, createdAt: Date.now() } as Vault;
      }

      const raw = await invoke('get_vaults');
      const arr = raw && raw.length ? JSON.parse(raw) : [];
      const newVault: Vault = { id: crypto.randomUUID(), name, path, createdAt: Date.now() };
      arr.push(newVault);
      await invoke('save_vaults', { json: JSON.stringify(arr) });
      await invoke('save_tree', { vault_id: newVault.id, json: JSON.stringify(ensureDefaultStructure([])) });
      this.write(this.VAULTS_KEY, JSON.stringify(arr));
      return newVault;
    } catch {
      const raw = this.read(this.VAULTS_KEY);
      const arr = raw && raw.length ? JSON.parse(raw) : [];
      const newVault: Vault = { id: crypto.randomUUID(), name, path, createdAt: Date.now() };
      arr.push(newVault);
      this.write(this.VAULTS_KEY, JSON.stringify(arr));
      this.write(`${this.TREE_PREFIX}${newVault.id}`, JSON.stringify(ensureDefaultStructure([])));
      return newVault;
    }
  }

  async deleteVault(id: string): Promise<void> {
    try {
      const invoke = await this.getInvoke();
      const raw = await invoke('get_vaults');
      const arr = raw && raw.length ? JSON.parse(raw) : [];
      const filtered = arr.filter((v: any) => v.id !== id);
      await invoke('save_vaults', { json: JSON.stringify(filtered) });
      await invoke('delete_vault', { vault_id: id });
      this.write(this.VAULTS_KEY, JSON.stringify(filtered));
    } catch {
      const raw = this.read(this.VAULTS_KEY);
      const arr = raw && raw.length ? JSON.parse(raw) : [];
      const filtered = arr.filter((v: any) => v.id !== id);
      this.write(this.VAULTS_KEY, JSON.stringify(filtered));
      this.write(`${this.TREE_PREFIX}${id}`, null);
      this.write(`${this.WORKSPACE_PLUGINS_PREFIX}${id}`, null);
    }
  }

  async loadTree(vaultId: string): Promise<FileSystemNode[]> {
    try { const invoke = await this.getInvoke(); const raw = await invoke('load_tree', { vault_id: vaultId }); const s = raw || '[]'; return JSON.parse(s); } catch { const raw = this.read(`${this.TREE_PREFIX}${vaultId}`); return raw ? JSON.parse(raw) : []; }
  }
  async saveTree(vaultId: string, tree: FileSystemNode[]): Promise<void> { try { const invoke = await this.getInvoke(); await invoke('save_tree', { vault_id: vaultId, json: JSON.stringify(tree) }); this.write(`${this.TREE_PREFIX}${vaultId}`, JSON.stringify(tree)); } catch { this.write(`${this.TREE_PREFIX}${vaultId}`, JSON.stringify(tree)); } }

  async loadFileContent(fileId: string): Promise<any> { try { const invoke = await this.getInvoke(); const raw = await invoke('load_file_content', { file_id: fileId }); if (!raw) return null; try { return JSON.parse(raw); } catch { return raw; } } catch { const raw = this.read(`${this.CONTENT_PREFIX}${fileId}`); if (!raw) return null; try { return JSON.parse(raw); } catch { return raw; } }
  }
  async saveFileContent(fileId: string, content: any): Promise<void> { const payload = typeof content === 'string' ? content : JSON.stringify(content); try { const invoke = await this.getInvoke(); await invoke('save_file_content', { file_id: fileId, json: payload }); this.write(`${this.CONTENT_PREFIX}${fileId}`, payload); } catch { this.write(`${this.CONTENT_PREFIX}${fileId}`, payload); } }

  async getGlobalPluginIds(): Promise<string[]> { try { const invoke = await this.getInvoke(); const raw = await invoke('get_global_plugin_ids'); return raw && raw.length ? JSON.parse(raw) : []; } catch { const raw = this.read(this.GLOBAL_PLUGINS_KEY); return raw && raw.length ? JSON.parse(raw) : []; } }
  async saveGlobalPluginIds(ids: string[]): Promise<void> { try { const invoke = await this.getInvoke(); await invoke('save_global_plugin_ids', { json: JSON.stringify(ids) }); this.write(this.GLOBAL_PLUGINS_KEY, JSON.stringify(ids)); } catch { this.write(this.GLOBAL_PLUGINS_KEY, JSON.stringify(ids)); } }
  async getWorkspacePluginIds(vaultId: string): Promise<string[]> { try { const invoke = await this.getInvoke(); const raw = await invoke('get_workspace_plugin_ids', { vault_id: vaultId }); return raw && raw.length ? JSON.parse(raw) : []; } catch { const raw = this.read(`${this.WORKSPACE_PLUGINS_PREFIX}${vaultId}`); return raw && raw.length ? JSON.parse(raw) : []; } }
  async saveWorkspacePluginIds(vaultId: string, ids: string[]): Promise<void> { try { const invoke = await this.getInvoke(); await invoke('save_workspace_plugin_ids', { vault_id: vaultId, json: JSON.stringify(ids) }); this.write(`${this.WORKSPACE_PLUGINS_PREFIX}${vaultId}`, JSON.stringify(ids)); } catch { this.write(`${this.WORKSPACE_PLUGINS_PREFIX}${vaultId}`, JSON.stringify(ids)); } }

  async getInstalledRemotePlugins(): Promise<{ id: string; code: string; manifestUrl: string }[]> { try { const invoke = await this.getInvoke(); const raw = await invoke('get_installed_remote_plugins'); return raw && raw.length ? JSON.parse(raw) : []; } catch { const raw = this.read(this.REMOTE_PLUGINS_KEY); return raw && raw.length ? JSON.parse(raw) : []; } }
  async saveInstalledRemotePlugin(plugin: { id: string; code: string; manifestUrl: string }): Promise<void> { try { const invoke = await this.getInvoke(); await invoke('save_installed_remote_plugin', { json: JSON.stringify(plugin) }); } catch { const raw = this.read(this.REMOTE_PLUGINS_KEY); const arr = raw && raw.length ? JSON.parse(raw) : []; const idx = arr.findIndex((p: any) => p.id === plugin.id); if (idx >= 0) arr[idx] = plugin; else arr.push(plugin); this.write(this.REMOTE_PLUGINS_KEY, JSON.stringify(arr)); } }
  async removeInstalledRemotePlugin(id: string): Promise<void> { try { const invoke = await this.getInvoke(); await invoke('remove_installed_remote_plugin', { id }); } catch { const raw = this.read(this.REMOTE_PLUGINS_KEY); if (!raw) return; const arr = JSON.parse(raw).filter((p: any) => p.id !== id); this.write(this.REMOTE_PLUGINS_KEY, JSON.stringify(arr)); } }

  async getAIDockConfig(): Promise<{ url: string; name: string } | null> { try { const invoke = await this.getInvoke(); const raw = await invoke('get_ai_dock_config'); return raw && raw.length ? JSON.parse(raw) : null; } catch { const raw = this.read(this.AI_DOCK_CONFIG_KEY); return raw && raw.length ? JSON.parse(raw) : null; } }
  async saveAIDockConfig(config: { url: string; name: string } | null): Promise<void> { try { const invoke = await this.getInvoke(); if (config) await invoke('save_ai_dock_config', { json: JSON.stringify(config) }); else await invoke('save_ai_dock_config', { json: '' }); if (config) this.write(this.AI_DOCK_CONFIG_KEY, JSON.stringify(config)); else this.write(this.AI_DOCK_CONFIG_KEY, ''); } catch { if (config) this.write(this.AI_DOCK_CONFIG_KEY, JSON.stringify(config)); else this.write(this.AI_DOCK_CONFIG_KEY, ''); } }

  async getPreference(key: string): Promise<string | null> { try { const invoke = await this.getInvoke(); const raw = await invoke('get_preference', { key }); return raw && raw.length ? raw : null; } catch { const prefsRaw = this.read(this.PREFERENCES_KEY); try { const prefs = prefsRaw ? JSON.parse(prefsRaw) : {}; return prefs[key] || null; } catch { return null; } } }
  async savePreference(key: string, value: string): Promise<void> { try { const invoke = await this.getInvoke(); await invoke('save_preference', { key, value }); const prefsRaw = this.read(this.PREFERENCES_KEY); const prefs = prefsRaw ? JSON.parse(prefsRaw) : {}; prefs[key] = value; this.write(this.PREFERENCES_KEY, JSON.stringify(prefs)); } catch { const prefsRaw = this.read(this.PREFERENCES_KEY); const prefs = prefsRaw ? JSON.parse(prefsRaw) : {}; prefs[key] = value; this.write(this.PREFERENCES_KEY, JSON.stringify(prefs)); } }

  async getVaultRootPath(): Promise<string | null> { try { const invoke = await this.getInvoke(); const raw = await invoke('get_vault_root_path'); return raw && raw.length ? raw : null; } catch { const raw = this.read(this.VAULT_ROOT_KEY); return raw && raw.length ? raw : null; } }
  async setVaultRootPath(path: string | null): Promise<void> { try { const invoke = await this.getInvoke(); if (path === null) await invoke('set_vault_root_path', { path: '' }); else await invoke('set_vault_root_path', { path }); if (path === null) this.write(this.VAULT_ROOT_KEY, null); else this.write(this.VAULT_ROOT_KEY, path); } catch { if (path === null) this.write(this.VAULT_ROOT_KEY, null); else this.write(this.VAULT_ROOT_KEY, path); } }
}

// Minimal Tauri adapter that forwards to the Rust backend via invoke
class TauriAdapter implements IStorageAdapter {
  private async invokeFn() {
    const mod = await import(/* @vite-ignore */ "@tauri-apps/api/tauri");
    return (mod.invoke ?? (mod.default && mod.default.invoke)) as (
      cmd: string,
      payload?: any,
    ) => Promise<any>;
  }

  async getVaults(): Promise<Vault[]> {
    const invoke = await this.invokeFn();
    const raw = await invoke("get_vaults");
    const s = raw || "[]";
    return JSON.parse(s);
  }
  async createVault(name: string, path: string): Promise<Vault> {
    const invoke = await this.invokeFn();

    const isAbsolute = (p: string) => {
      if (!p) return false;
      if (p.startsWith('/')) return true;
      if (/^[A-Za-z]:[\\/]/.test(p)) return true;
      if (p.startsWith('\\\\')) return true;
      return false;
    };

    if (isAbsolute(path)) {
      const id = await invoke('create_vault_at_path', { name, path });
      await invoke('save_tree', { vault_id: id, json: JSON.stringify(ensureDefaultStructure([])) });
      const raw = await invoke('get_vaults');
      const arr = raw && raw.length ? JSON.parse(raw) : [];
      const found = arr.find((v: any) => v.id === id);
      if (found) return found as Vault;
      return { id, name, path, createdAt: Date.now() } as Vault;
    }

    const raw = await invoke('get_vaults');
    const arr = raw && raw.length ? JSON.parse(raw) : [];
    const newVault: Vault = {
      id: crypto.randomUUID(),
      name,
      path,
      createdAt: Date.now(),
    };
    arr.push(newVault);
    await invoke('save_vaults', { json: JSON.stringify(arr) });
    await invoke('save_tree', {
      vault_id: newVault.id,
      json: JSON.stringify(ensureDefaultStructure([])),
    });
    return newVault;
  }
  async deleteVault(id: string): Promise<void> {
    const invoke = await this.invokeFn();
    const raw = await invoke("get_vaults");
    const arr = raw && raw.length ? JSON.parse(raw) : [];
    const filtered = arr.filter((v: any) => v.id !== id);
    await invoke("save_vaults", { json: JSON.stringify(filtered) });
    await invoke("delete_vault", { vault_id: id });
  }
  async loadTree(vaultId: string): Promise<FileSystemNode[]> {
    const invoke = await this.invokeFn();
    const raw = await invoke("load_tree", { vault_id: vaultId });
    const s = raw || "[]";
    return JSON.parse(s);
  }
  async saveTree(vaultId: string, tree: FileSystemNode[]): Promise<void> {
    const invoke = await this.invokeFn();
    await invoke("save_tree", {
      vault_id: vaultId,
      json: JSON.stringify(tree),
    });
  }
  async loadFileContent(fileId: string): Promise<any> {
    const invoke = await this.invokeFn();
    const raw = await invoke("load_file_content", { file_id: fileId });
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  async saveFileContent(fileId: string, content: any): Promise<void> {
    const invoke = await this.invokeFn();
    const payload =
      typeof content === "string" ? content : JSON.stringify(content);
    await invoke("save_file_content", { file_id: fileId, json: payload });
  }

  async getGlobalPluginIds(): Promise<string[]> {
    const invoke = await this.invokeFn();
    const raw = await invoke("get_global_plugin_ids");
    return raw && raw.length ? JSON.parse(raw) : [];
  }
  async saveGlobalPluginIds(ids: string[]): Promise<void> {
    const invoke = await this.invokeFn();
    await invoke("save_global_plugin_ids", { json: JSON.stringify(ids) });
  }
  async getWorkspacePluginIds(vaultId: string): Promise<string[]> {
    const invoke = await this.invokeFn();
    const raw = await invoke("get_workspace_plugin_ids", { vault_id: vaultId });
    return raw && raw.length ? JSON.parse(raw) : [];
  }
  async saveWorkspacePluginIds(vaultId: string, ids: string[]): Promise<void> {
    const invoke = await this.invokeFn();
    await invoke("save_workspace_plugin_ids", {
      vault_id: vaultId,
      json: JSON.stringify(ids),
    });
  }

  async getInstalledRemotePlugins(): Promise<
    { id: string; code: string; manifestUrl: string }[]
  > {
    const invoke = await this.invokeFn();
    const raw = await invoke("get_installed_remote_plugins");
    return raw && raw.length ? JSON.parse(raw) : [];
  }
  async saveInstalledRemotePlugin(plugin: {
    id: string;
    code: string;
    manifestUrl: string;
  }): Promise<void> {
    const invoke = await this.invokeFn();
    await invoke("save_installed_remote_plugin", {
      json: JSON.stringify(plugin),
    });
  }
  async removeInstalledRemotePlugin(id: string): Promise<void> {
    const invoke = await this.invokeFn();
    await invoke("remove_installed_remote_plugin", { id });
  }

  async getAIDockConfig(): Promise<{ url: string; name: string } | null> {
    const invoke = await this.invokeFn();
    const raw = await invoke("get_ai_dock_config");
    return raw && raw.length ? JSON.parse(raw) : null;
  }
  async saveAIDockConfig(
    config: { url: string; name: string } | null,
  ): Promise<void> {
    const invoke = await this.invokeFn();
    if (config)
      await invoke("save_ai_dock_config", { json: JSON.stringify(config) });
    else await invoke("save_ai_dock_config", { json: "" });
  }

  async getPreference(key: string): Promise<string | null> {
    const invoke = await this.invokeFn();
    const raw = await invoke("get_preference", { key });
    return raw && raw.length ? raw : null;
  }
  async savePreference(key: string, value: string): Promise<void> {
    const invoke = await this.invokeFn();
    await invoke("save_preference", { key, value });
  }
  async getVaultRootPath(): Promise<string | null> {
    const invoke = await this.invokeFn();
    const raw = await invoke("get_vault_root_path");
    return raw && raw.length ? raw : null;
  }
  async setVaultRootPath(path: string | null): Promise<void> {
    const invoke = await this.invokeFn();
    if (path === null) await invoke("set_vault_root_path", { path: "" });
    else await invoke("set_vault_root_path", { path });
  }
}

// Proxy adapter that delegates to an active adapter. Starts with in-memory and may switch.
class ProxyStorage implements IStorageAdapter {
  private delegate: IStorageAdapter;
  private switched = false;
  private readonly TIMEOUT_MS = 5000; // how long to wait for Tauri before falling back to localStorage
  constructor() {
    // Try to detect a usable `@tauri-apps/api/tauri` module first. Avoid
    // starting with a Tauri adapter when running in a browser with the
    // tauri-web-stub. If detection succeeds, use the Tauri adapter; otherwise
    // start with LocalStorage and poll to switch.
    (async () => {
      try {
        const mod = await import(/* @vite-ignore */ "@tauri-apps/api/tauri");
        const invoke = (mod.invoke ?? (mod.default && mod.default.invoke)) as any;
        if (typeof invoke === 'function' && typeof (window as any).__TAURI__ !== 'undefined') {
          try {
            const res = await invoke('ping');
            if (res === 'pong') {
              this.delegate = new FileAdapterV2();
              this.switched = true;
              console.info('Storage: using FileAdapterV2 (Tauri ping OK).');
              return;
            }
          } catch (e) {
            console.warn('Storage: ping to Tauri failed (treating as stub)', e);
          }
        }
      } catch (e) {
        // ignore import errors
      }

      // Default fallback for web/dev: use LocalStorage adapter and poll.
      this.delegate = new LocalStorageAdapter();
      this.waitForTauriAndMaybeSwitch();
    })();
  }

  private async waitForTauriAndMaybeSwitch() {
    const available = await waitForTauri(this.TIMEOUT_MS);
    if (available) {
      await this.switchToTauri();
    } else {
      // fallback to LocalStorageAdapter for non-Tauri web usage
      this.delegate = new LocalStorageAdapter();
      this.switched = true;
    }
  }

  private isTauriError(err: any) {
    if (!err) return false;
    const msg = String(err?.message || err);
    return (
      msg.includes('[Tauri stub]') ||
      msg.includes('Tauri runtime not available') ||
      msg.includes("'@tauri-apps/api/tauri'")
    );
  }

  private async exec<T>(fn: (d: IStorageAdapter) => Promise<T>): Promise<T> {
    try {
      return await fn(this.delegate);
    } catch (e) {
      if (this.isTauriError(e) && !(this.delegate instanceof LocalStorageAdapter)) {
        console.warn('Storage: detected Tauri stub error; switching to LocalStorage adapter.', e);
        this.delegate = new LocalStorageAdapter();
        this.switched = true;
        try {
          return await fn(this.delegate);
        } catch (inner) {
          // fall through and throw original
        }
      }
      throw e;
    }
  }

  private async switchToTauri() {
    try {
      const tauri = new FileAdapterV2();
      // Attempt migration of legacy localStorage keys into Tauri FS (best-effort)
      try {
        // dynamic import for invoke
        const mod = await import(/* @vite-ignore */ "@tauri-apps/api/tauri");
        const invoke = (mod.invoke ?? (mod.default && mod.default.invoke)) as (
          cmd: string,
          payload?: any,
        ) => Promise<any>;
        const migrateKey = async (
          key: string,
          cmd: string,
          payloadKey?: string,
        ) => {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) return;
            const payload: any = {};
            payload[payloadKey ?? "json"] = raw;
            await invoke(cmd, payload);
          } catch (e) {
            console.warn("migration error for key", key, e);
          }
        };

        await migrateKey("focosx_vaults", "save_vaults", "json");

        // Trees
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith("focosx_tree_")) {
            const vaultId = k.substring("focosx_tree_".length);
            const raw = localStorage.getItem(k);
            if (raw)
              await invoke("save_tree", { vault_id: vaultId, json: raw });
          }
        }

        // Contents
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith("focosx_content_")) {
            const fileId = k.substring("focosx_content_".length);
            const raw = localStorage.getItem(k);
            if (raw)
              await invoke("save_file_content", { file_id: fileId, json: raw });
          }
        }

        await migrateKey(
          "focosx_global_plugins",
          "save_global_plugin_ids",
          "json",
        );

        // Workspace plugins
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith("focosx_workspace_plugins_")) {
            const vaultId = k.substring("focosx_workspace_plugins_".length);
            const raw = localStorage.getItem(k);
            if (raw)
              await invoke("save_workspace_plugin_ids", {
                vault_id: vaultId,
                json: raw,
              });
          }
        }

        // Remote plugins
        const remRaw = localStorage.getItem("focosx_remote_plugins_source");
        if (remRaw) {
          try {
            const arr = JSON.parse(remRaw);
            if (Array.isArray(arr)) {
              for (const p of arr) {
                await invoke("save_installed_remote_plugin", {
                  json: JSON.stringify(p),
                });
              }
            } else {
              await invoke("save_installed_remote_plugin", { json: remRaw });
            }
          } catch {
            await invoke("save_installed_remote_plugin", { json: remRaw });
          }
        }

        await migrateKey(
          "focosx_ai_dock_config",
          "save_ai_dock_config",
          "json",
        );

        const prefsRaw = localStorage.getItem("focosx_preferences");
        if (prefsRaw) {
          try {
            const prefs = JSON.parse(prefsRaw);
            if (prefs && typeof prefs === "object") {
              for (const [k, v] of Object.entries(prefs)) {
                await invoke("save_preference", { key: k, value: String(v) });
              }
            } else {
              await invoke("save_preference", {
                key: "migrated_preferences",
                value: prefsRaw,
              });
            }
          } catch {
            await invoke("save_preference", {
              key: "migrated_preferences",
              value: prefsRaw,
            });
          }
        }

        // Attempt best-effort cleanup of legacy localStorage keys
        try {
          localStorage.removeItem("focosx_vaults");
          localStorage.removeItem("focosx_preferences");
        } catch {
          /* ignore */
        }
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (
            k.startsWith("focosx_tree_") ||
            k.startsWith("focosx_content_") ||
            k.startsWith("focosx_workspace_plugins_") ||
            k === "focosx_global_plugins" ||
            k === "focosx_remote_plugins_source" ||
            k === "focosx_ai_dock_config"
          ) {
            try {
              localStorage.removeItem(k);
            } catch {
              /* ignore */
            }
          }
        }
      } catch (e) {
        // migration best-effort; continue
        console.warn("migration to tauri failed:", e);
      }

      // switch delegate
      this.delegate = tauri;
      this.switched = true;
    } catch (e) {
      console.warn(
        "failed to switch to TauriAdapter, continuing with in-memory/local fallback",
        e,
      );
      // leave delegate as-is (in-memory) or let timeout trigger fallback to localStorage
    }
  }

  private getDelegate(): IStorageAdapter {
    return this.delegate;
  }
  async getVaults(): Promise<Vault[]> {
    return this.exec((d) => d.getVaults());
  }
  async createVault(name: string, path: string): Promise<Vault> {
    return this.exec((d) => d.createVault(name, path));
  }
  async deleteVault(id: string): Promise<void> {
    return this.exec((d) => d.deleteVault(id));
  }
  async loadTree(vaultId: string): Promise<FileSystemNode[]> {
    return this.exec((d) => d.loadTree(vaultId));
  }
  async saveTree(vaultId: string, tree: FileSystemNode[]): Promise<void> {
    return this.exec((d) => d.saveTree(vaultId, tree));
  }
  async loadFileContent(fileId: string): Promise<any> {
    return this.exec((d) => d.loadFileContent(fileId));
  }
  async saveFileContent(fileId: string, content: any): Promise<void> {
    return this.exec((d) => d.saveFileContent(fileId, content));
  }
  async getGlobalPluginIds(): Promise<string[]> {
    return this.exec((d) => d.getGlobalPluginIds());
  }
  async saveGlobalPluginIds(ids: string[]): Promise<void> {
    return this.exec((d) => d.saveGlobalPluginIds(ids));
  }
  async getWorkspacePluginIds(vaultId: string): Promise<string[]> {
    return this.exec((d) => d.getWorkspacePluginIds(vaultId));
  }
  async saveWorkspacePluginIds(vaultId: string, ids: string[]): Promise<void> {
    return this.exec((d) => d.saveWorkspacePluginIds(vaultId, ids));
  }
  async getInstalledRemotePlugins(): Promise<
    { id: string; code: string; manifestUrl: string }[]
  > {
    return this.exec((d) => d.getInstalledRemotePlugins());
  }
  async saveInstalledRemotePlugin(plugin: {
    id: string;
    code: string;
    manifestUrl: string;
  }): Promise<void> {
    return this.exec((d) => d.saveInstalledRemotePlugin(plugin));
  }
  async removeInstalledRemotePlugin(id: string): Promise<void> {
    return this.exec((d) => d.removeInstalledRemotePlugin(id));
  }
  async getAIDockConfig(): Promise<{ url: string; name: string } | null> {
    return this.exec((d) => d.getAIDockConfig());
  }
  async saveAIDockConfig(
    config: { url: string; name: string } | null,
  ): Promise<void> {
    return this.exec((d) => d.saveAIDockConfig(config));
  }
  async getPreference(key: string): Promise<string | null> {
    return this.exec((d) => d.getPreference(key));
  }
  async savePreference(key: string, value: string): Promise<void> {
    return this.exec((d) => d.savePreference(key, value));
  }
  async getVaultRootPath(): Promise<string | null> {
    return this.exec((d) => d.getVaultRootPath());
  }
  async setVaultRootPath(path: string | null): Promise<void> {
    return this.exec((d) => d.setVaultRootPath(path));
  }
}

// Export proxied instance
export const storage: IStorageAdapter = new ProxyStorage();

/**
 * Helper to initialize default assets folder if missing
 */
export const ensureDefaultStructure = (
  tree: FileSystemNode[],
): FileSystemNode[] => {
  const defaults = ["Notes", "Canvases", "assets"];
  let newTree = [...tree];

  defaults.forEach((name) => {
    const exists = newTree.find(
      (n) => n.name === name && n.type === FileType.FOLDER,
    );
    if (!exists) {
      newTree.push({
        id: name === "assets" ? "assets-folder" : crypto.randomUUID(),
        name,
        type: FileType.FOLDER,
        parentId: null,
        children: [],
      });
    }
  });

  // Add a default canvas file if no canvases exist
  const hasCanvas = newTree.some((n) => n.type === FileType.CANVAS);
  if (!hasCanvas) {
    const canvasId = crypto.randomUUID();
    newTree.push({
      id: canvasId,
      name: "Welcome.canvas",
      type: FileType.CANVAS,
      parentId: null, // Root
    });

    // Save default content for this canvas
    const defaultContent = {
      id: canvasId,
      name: "Welcome",
      frames: [
        {
          id: "welcome-note",
          type: "sticky-note",
          x: 100,
          y: 100,
          width: 300,
          height: 200,
          content:
            "Welcome to FocosX!\n\nTry using the toolbar at the bottom to draw on the canvas or add new frames.",
          strokes: [],
        },
        {
          id: "example-image",
          type: "image",
          x: 450,
          y: 100,
          width: 300,
          height: 200,
          content: "", // Empty content to show upload UI
          strokes: [],
        },
      ],
      globalStrokes: [],
    };
    storage.saveFileContent(canvasId, defaultContent);
  }

  // Add a default CSV file if missing
  const hasCSV = newTree.some((n) => n.name.endsWith(".csv"));
  if (!hasCSV) {
    const csvId = crypto.randomUUID();
    newTree.push({
      id: csvId,
      name: "Data.csv",
      type: FileType.FILE,
      parentId: null, // Root
    });

    // Save default content
    const defaultCSVContent =
      "Name,Role,Department\nAlice,Engineer,Product\nBob,Designer,Product\nCharlie,Manager,Sales";
    storage.saveFileContent(csvId, defaultCSVContent);
  }

  return newTree;
};
