import { FileSystemNode, Vault } from "../../types";
import IStorageAdapter from "./IStorageAdapter";

export class InMemoryAdapter implements IStorageAdapter {
  private store = new Map<string, string>();
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
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  private write(key: string, value: string | null) {
    if (value === null || value === undefined) this.store.delete(key);
    else this.store.set(key, value);
  }

  async getVaults(): Promise<Vault[]> {
    const raw = this.read(this.VAULTS_KEY);
    if (!raw) {
      // Return empty array - user should create vaults explicitly
      return [];
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
    // Do not create default structure - vaults start empty
    this.write(`${this.TREE_PREFIX}${newVault.id}`, JSON.stringify([]));
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
    const payload = typeof content === "string" ? content : JSON.stringify(content);
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
    this.write(`${this.WORKSPACE_PLUGINS_PREFIX}${vaultId}`, JSON.stringify(ids));
  }

  async getInstalledRemotePlugins(): Promise<{ id: string; code: string; manifestUrl: string }[]> {
    const raw = this.read(this.REMOTE_PLUGINS_KEY);
    return raw && raw.length ? JSON.parse(raw) : [];
  }
  async saveInstalledRemotePlugin(plugin: { id: string; code: string; manifestUrl: string }): Promise<void> {
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
  async saveAIDockConfig(config: { url: string; name: string } | null): Promise<void> {
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

  async getVaultRootPath(): Promise<string | null> {
    const raw = this.read(this.VAULT_ROOT_KEY);
    return raw && raw.length ? raw : null;
  }
  async setVaultRootPath(path: string | null): Promise<void> {
    if (path === null) this.write(this.VAULT_ROOT_KEY, null);
    else this.write(this.VAULT_ROOT_KEY, path);
  }

  // In-memory adapter doesn't support real file system operations
  // These are no-ops that return empty values
  async createNode(_vaultId: string, _parentId: string | null, _name: string, _type: string): Promise<string> {
    return crypto.randomUUID();
  }
  async deleteNode(_vaultId: string, _id: string): Promise<void> {
    // no-op for in-memory
  }
  async renameNode(_vaultId: string, id: string, _newName: string): Promise<string> {
    return id;
  }
}

export default InMemoryAdapter;
