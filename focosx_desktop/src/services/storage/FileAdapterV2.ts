import { FileSystemNode, Vault } from "../../types";
import IStorageAdapter from "./IStorageAdapter";

export class FileAdapterV2 implements IStorageAdapter {
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
    const mod = await import(/* @vite-ignore */ "@tauri-apps/api/core");
    const invoke = mod.invoke as (
      cmd: string,
      payload?: any,
    ) => Promise<any>;
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
      // Fallback - return empty array if no vaults exist
      const raw = this.read(this.VAULTS_KEY);
      if (!raw) {
        return [];
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
        // Real filesystem vault - starts empty, no default structure
        const raw = await invoke('get_vaults');
        const arr = raw && raw.length ? JSON.parse(raw) : [];
        try { localStorage.setItem(this.VAULTS_KEY, JSON.stringify(arr)); } catch {}
        const found = arr.find((v: any) => v.id === id);
        if (found) return found as Vault;
        return { id, name, path, createdAt: Date.now() } as Vault;
      }

      // App-managed vault - starts empty, no default structure
      const raw = await invoke('get_vaults');
      const arr = raw && raw.length ? JSON.parse(raw) : [];
      const newVault: Vault = { id: crypto.randomUUID(), name, path, createdAt: Date.now() };
      arr.push(newVault);
      await invoke('save_vaults', { json: JSON.stringify(arr) });
      try { localStorage.setItem(this.VAULTS_KEY, JSON.stringify(arr)); } catch {}
      await invoke('save_tree', { vaultId: newVault.id, json: JSON.stringify([]) });
      this.write(this.VAULTS_KEY, JSON.stringify(arr));
      return newVault;
    } catch (e) {
      // Fallback - vaults start empty
      const raw = this.read(this.VAULTS_KEY);
      const arr = raw && raw.length ? JSON.parse(raw) : [];
      const newVault: Vault = { id: crypto.randomUUID(), name, path, createdAt: Date.now() };
      arr.push(newVault);
      this.write(this.VAULTS_KEY, JSON.stringify(arr));
      this.write(`${this.TREE_PREFIX}${newVault.id}`, JSON.stringify([]));
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
      try { localStorage.setItem(this.VAULTS_KEY, JSON.stringify(filtered)); } catch {}
      await invoke('delete_vault', { vaultId: id });
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
    try { const invoke = await this.getInvoke(); const raw = await invoke('load_tree', { vaultId }); const s = raw || '[]'; return JSON.parse(s); } catch { const raw = this.read(`${this.TREE_PREFIX}${vaultId}`); return raw ? JSON.parse(raw) : []; }
  }
  async saveTree(vaultId: string, tree: FileSystemNode[]): Promise<void> { try { const invoke = await this.getInvoke(); await invoke('save_tree', { vaultId, json: JSON.stringify(tree) }); this.write(`${this.TREE_PREFIX}${vaultId}`, JSON.stringify(tree)); } catch { this.write(`${this.TREE_PREFIX}${vaultId}`, JSON.stringify(tree)); } }

  async loadFileContent(fileId: string): Promise<any> { try { const invoke = await this.getInvoke(); const raw = await invoke('load_file_content', { fileId }); if (!raw) return null; try { return JSON.parse(raw); } catch { return raw; } } catch { const raw = this.read(`${this.CONTENT_PREFIX}${fileId}`); if (!raw) return null; try { return JSON.parse(raw); } catch { return raw; } }
  }
  async saveFileContent(fileId: string, content: any): Promise<void> { const payload = typeof content === 'string' ? content : JSON.stringify(content); try { const invoke = await this.getInvoke(); await invoke('save_file_content', { fileId, json: payload }); this.write(`${this.CONTENT_PREFIX}${fileId}`, payload); } catch { this.write(`${this.CONTENT_PREFIX}${fileId}`, payload); } }

  async getGlobalPluginIds(): Promise<string[]> { try { const invoke = await this.getInvoke(); const raw = await invoke('get_global_plugin_ids'); return raw && raw.length ? JSON.parse(raw) : []; } catch { const raw = this.read(this.GLOBAL_PLUGINS_KEY); return raw && raw.length ? JSON.parse(raw) : []; } }
  async saveGlobalPluginIds(ids: string[]): Promise<void> { try { const invoke = await this.getInvoke(); await invoke('save_global_plugin_ids', { json: JSON.stringify(ids) }); this.write(this.GLOBAL_PLUGINS_KEY, JSON.stringify(ids)); } catch { this.write(this.GLOBAL_PLUGINS_KEY, JSON.stringify(ids)); } }

  async getWorkspacePluginIds(vaultId: string): Promise<string[]> { try { const invoke = await this.getInvoke(); const raw = await invoke('get_workspace_plugin_ids', { vaultId }); return raw && raw.length ? JSON.parse(raw) : []; } catch { const raw = this.read(`${this.WORKSPACE_PLUGINS_PREFIX}${vaultId}`); return raw && raw.length ? JSON.parse(raw) : []; } }
  async saveWorkspacePluginIds(vaultId: string, ids: string[]): Promise<void> { try { const invoke = await this.getInvoke(); await invoke('save_workspace_plugin_ids', { vaultId, json: JSON.stringify(ids) }); this.write(`${this.WORKSPACE_PLUGINS_PREFIX}${vaultId}`, JSON.stringify(ids)); } catch { this.write(`${this.WORKSPACE_PLUGINS_PREFIX}${vaultId}`, JSON.stringify(ids)); } }

  async getInstalledRemotePlugins(): Promise<{ id: string; code: string; manifestUrl: string }[]> { try { const invoke = await this.getInvoke(); const raw = await invoke('get_installed_remote_plugins'); return raw && raw.length ? JSON.parse(raw) : []; } catch { const raw = this.read(this.REMOTE_PLUGINS_KEY); return raw && raw.length ? JSON.parse(raw) : []; } }
  async saveInstalledRemotePlugin(plugin: { id: string; code: string; manifestUrl: string }): Promise<void> { try { const invoke = await this.getInvoke(); await invoke('save_installed_remote_plugin', { json: JSON.stringify(plugin) }); } catch { const raw = this.read(this.REMOTE_PLUGINS_KEY); const arr = raw && raw.length ? JSON.parse(raw) : []; const idx = arr.findIndex((p: any) => p.id === plugin.id); if (idx >= 0) arr[idx] = plugin; else arr.push(plugin); this.write(this.REMOTE_PLUGINS_KEY, JSON.stringify(arr)); } }
  async removeInstalledRemotePlugin(id: string): Promise<void> { try { const invoke = await this.getInvoke(); await invoke('remove_installed_remote_plugin', { id }); } catch { const raw = this.read(this.REMOTE_PLUGINS_KEY); if (!raw) return; const arr = JSON.parse(raw).filter((p: any) => p.id !== id); this.write(this.REMOTE_PLUGINS_KEY, JSON.stringify(arr)); } }

  async getAIDockConfig(): Promise<{ url: string; name: string } | null> { try { const invoke = await this.getInvoke(); const raw = await invoke('get_ai_dock_config'); return raw && raw.length ? JSON.parse(raw) : null; } catch { const raw = this.read(this.AI_DOCK_CONFIG_KEY); return raw && raw.length ? JSON.parse(raw) : null; } }
  async saveAIDockConfig(config: { url: string; name: string } | null): Promise<void> { try { const invoke = await this.getInvoke(); if (config) await invoke('save_ai_dock_config', { json: JSON.stringify(config) }); else await invoke('save_ai_dock_config', { json: '' }); if (config) this.write(this.AI_DOCK_CONFIG_KEY, JSON.stringify(config)); else this.write(this.AI_DOCK_CONFIG_KEY, ''); } catch { if (config) this.write(this.AI_DOCK_CONFIG_KEY, JSON.stringify(config)); else this.write(this.AI_DOCK_CONFIG_KEY, ''); } }

  async getPreference(key: string): Promise<string | null> { try { const invoke = await this.getInvoke(); const raw = await invoke('get_preference', { key }); return raw && raw.length ? raw : null; } catch { const prefsRaw = this.read(this.PREFERENCES_KEY); try { const prefs = prefsRaw ? JSON.parse(prefsRaw) : {}; return prefs[key] || null; } catch { return null; } } }
  async savePreference(key: string, value: string): Promise<void> { try { const invoke = await this.getInvoke(); await invoke('save_preference', { key, value }); const prefsRaw = this.read(this.PREFERENCES_KEY); const prefs = prefsRaw ? JSON.parse(prefsRaw) : {}; prefs[key] = value; this.write(this.PREFERENCES_KEY, JSON.stringify(prefs)); } catch { const prefsRaw = this.read(this.PREFERENCES_KEY); const prefs = prefsRaw ? JSON.parse(prefsRaw) : {}; prefs[key] = value; this.write(this.PREFERENCES_KEY, JSON.stringify(prefs)); } }

  async getVaultRootPath(): Promise<string | null> { try { const invoke = await this.getInvoke(); const raw = await invoke('get_vault_root_path'); return raw && raw.length ? raw : null; } catch { const raw = this.read(this.VAULT_ROOT_KEY); return raw && raw.length ? raw : null; } }
  async setVaultRootPath(path: string | null): Promise<void> { try { const invoke = await this.getInvoke(); if (path === null) await invoke('set_vault_root_path', { path: '' }); else await invoke('set_vault_root_path', { path }); if (path === null) this.write(this.VAULT_ROOT_KEY, null); else this.write(this.VAULT_ROOT_KEY, path); } catch { if (path === null) this.write(this.VAULT_ROOT_KEY, null); else this.write(this.VAULT_ROOT_KEY, path); } }

  // Granular file operations - uses Tauri commands when available
  // Note: Tauri v2 auto-converts snake_case Rust params to camelCase JS params
  async createNode(vaultId: string, parentId: string | null, name: string, type: string): Promise<string> { 
    console.log('[FileAdapterV2] createNode called:', { vaultId, parentId, name, type });
    try { 
      const invoke = await this.getInvoke(); 
      console.log('[FileAdapterV2] Got invoke, calling create_node_cmd');
      const result = await invoke('create_node_cmd', { vaultId, parentId, name, nodeType: type }); 
      console.log('[FileAdapterV2] create_node_cmd returned:', result);
      return result;
    } catch (e) { 
      console.error('[FileAdapterV2] createNode error:', e);
      return crypto.randomUUID(); 
    } 
  }
  async deleteNode(vaultId: string, id: string): Promise<void> { try { const invoke = await this.getInvoke(); await invoke('delete_node_cmd', { vaultId, id }); } catch { /* no-op for fallback */ } }
  async renameNode(vaultId: string, id: string, newName: string): Promise<string> { try { const invoke = await this.getInvoke(); return await invoke('rename_node_cmd', { vaultId, id, newName }); } catch { return id; } }
}

export default FileAdapterV2;
