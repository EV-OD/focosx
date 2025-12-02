/**
 * StorageService
 *
 * - Exports a single `storage` instance implementing `IStorageAdapter`.
 * - Prefers the Tauri (Rust) backend when available and delegates all file
 *   operations to it. When Tauri is not present the app runs in-memory only
 *   and DOES NOT write to browser localStorage.
 *
 * Behavior:
 * - Desktop (Tauri): all persistence goes through Rust (filesystem).
 * - Web (browser): in-memory adapter only; data is not persisted to localStorage.
 * - When Tauri becomes available (in dev or actual desktop runtime) the service
 *   will attempt a best-effort migration of legacy `focosx_` localStorage keys
 *   into the Rust-managed filesystem, then remove those keys.
 *
 * Note: dynamic imports use `/* @vite-ignore` so Vite does not eagerly try to
 * resolve the native dependency during web builds.
 */

// Legacy compatibility: this file contains a built-in adapter implementation
// for non-desktop environments. It intentionally does NOT re-export the
// modular `storage` instance here to avoid duplicate-symbol exports when
// the modular implementation is included elsewhere in the bundle.

// Re-export the canonical modular storage so other modules importing
// `services/StorageService` get a consistent `storage` instance.
export { storage } from "./storage";
export { ensureDefaultStructure } from "./storage/utils";
// Note: keep the local `IStorageAdapter` declaration below for this module's
// internal implementations; it is exported by this file as well.


/**
 * Public storage adapter interface used by the app.
 */
export interface IStorageAdapter {
  getVaults(): Promise<Vault[]>;
  createVault(name: string, path: string): Promise<Vault>;
  deleteVault(id: string): Promise<void>;

  loadTree(vaultId: string): Promise<FileSystemNode[]>;
  saveTree(vaultId: string, tree: FileSystemNode[]): Promise<void>;

  loadFileContent(fileId: string): Promise<any>;
  saveFileContent(fileId: string, content: any): Promise<void>;

  getGlobalPluginIds(): Promise<string[]>;
  saveGlobalPluginIds(ids: string[]): Promise<void>;
  getWorkspacePluginIds(vaultId: string): Promise<string[]>;
  saveWorkspacePluginIds(vaultId: string, ids: string[]): Promise<void>;

  getInstalledRemotePlugins(): Promise<
    { id: string; code: string; manifestUrl: string }[]
  >;
  saveInstalledRemotePlugin(plugin: {
    id: string;
    code: string;
    manifestUrl: string;
  }): Promise<void>;
  removeInstalledRemotePlugin(id: string): Promise<void>;

  getAIDockConfig(): Promise<{ url: string; name: string } | null>;
  saveAIDockConfig(config: { url: string; name: string } | null): Promise<void>;

  getPreference(key: string): Promise<string | null>;
  savePreference(key: string, value: string): Promise<void>;
  // Vault filesystem root path (optional). When set, Rust will persist vaults
  // under this path. If null, app continues using current adapter behaviour.
  getVaultRootPath(): Promise<string | null>;
  setVaultRootPath(path: string | null): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/*                           In-memory adapter (web)                           */
/* -------------------------------------------------------------------------- */
/**
 * Keeps all data in-memory for the page lifecycle. Intentionally does NOT
 * touch localStorage or other persistent browser storage.
 */
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
  private VAULT_ROOT_KEY = "focosx_vault_root_path";

  private read(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  private write(key: string, value: string | null) {
    if (value === null || value === undefined) {
      this.store.delete(key);
    } else {
      this.store.set(key, value);
    }
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
      // initialize an in-memory tree
      this.write(`${this.TREE_PREFIX}${defaultVault.id}`, JSON.stringify(ensureDefaultStructure([])));
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
    this.write(`${this.TREE_PREFIX}${newVault.id}`, JSON.stringify(ensureDefaultStructure([])));
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
    if (!path) this.write(this.VAULT_ROOT_KEY, null);
    else this.write(this.VAULT_ROOT_KEY, path);
  }
}

/* -------------------------------------------------------------------------- */
/*                             File-backed adapter                             */
/* -------------------------------------------------------------------------- */
/**
 * FileAdapterV2 mirrors the InMemoryAdapter API but delegates I/O to the
 * Tauri/Rust backend when available. It keeps an internal in-memory cache so
 * calls remain fast and the adapter can operate in environments where the
 * native runtime isn't available (dev browser tab).
 */
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

  // Attempt to get a usable `invoke` function; perform a ping probe so we
  // avoid calling the tauri web-stub. If probe fails, throw so callers can
  // fallback to in-memory behaviour.
  private async getInvoke(): Promise<(cmd: string, payload?: any) => Promise<any>> {
    try {
      const mod = await import(/* @vite-ignore */ "@tauri-apps/api/tauri");
      const invoke = (mod.invoke ?? (mod.default && mod.default.invoke)) as (
        cmd: string,
        payload?: any,
      ) => Promise<any>;
      // ping probe
      try {
        const res = await invoke('ping');
        if (res === 'pong') return invoke;
      } catch (e) {
        // fallthrough to error
      }
      throw new Error('tauri invoke not responding');
    } catch (e) {
      throw e;
    }
  }

  async getVaults(): Promise<Vault[]> {
    // try native first
    try {
      const invoke = await this.getInvoke();
      const raw = await invoke('get_vaults');
      const s = raw || '[]';
      const arr = JSON.parse(s);
      // cache
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
      // reuse existing Tauri-backed behavior: if absolute path, call create_vault_at_path
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
    } catch (e) {
      // fallback to in-memory-like behavior
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
    try {
      const invoke = await this.getInvoke();
      const raw = await invoke('load_tree', { vault_id: vaultId });
      const s = raw || '[]';
      return JSON.parse(s);
    } catch {
      const raw = this.read(`${this.TREE_PREFIX}${vaultId}`);
      return raw ? JSON.parse(raw) : [];
    }
  }

  async saveTree(vaultId: string, tree: FileSystemNode[]): Promise<void> {
    try {
      const invoke = await this.getInvoke();
      await invoke('save_tree', { vault_id: vaultId, json: JSON.stringify(tree) });
      this.write(`${this.TREE_PREFIX}${vaultId}`, JSON.stringify(tree));
    } catch {
      this.write(`${this.TREE_PREFIX}${vaultId}`, JSON.stringify(tree));
    }
  }

  async loadFileContent(fileId: string): Promise<any> {
    try {
      const invoke = await this.getInvoke();
      const raw = await invoke('load_file_content', { file_id: fileId });
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return raw; }
    } catch {
      const raw = this.read(`${this.CONTENT_PREFIX}${fileId}`);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return raw; }
    }
  }

  async saveFileContent(fileId: string, content: any): Promise<void> {
    const payload = typeof content === 'string' ? content : JSON.stringify(content);
    try {
      const invoke = await this.getInvoke();
      await invoke('save_file_content', { file_id: fileId, json: payload });
      this.write(`${this.CONTENT_PREFIX}${fileId}`, payload);
    } catch {
      this.write(`${this.CONTENT_PREFIX}${fileId}`, payload);
    }
  }

  async getGlobalPluginIds(): Promise<string[]> {
    try {
      const invoke = await this.getInvoke();
      const raw = await invoke('get_global_plugin_ids');
      return raw && raw.length ? JSON.parse(raw) : [];
    } catch {
      const raw = this.read(this.GLOBAL_PLUGINS_KEY);
      return raw && raw.length ? JSON.parse(raw) : [];
    }
  }
  async saveGlobalPluginIds(ids: string[]): Promise<void> {
    try { const invoke = await this.getInvoke(); await invoke('save_global_plugin_ids', { json: JSON.stringify(ids) }); this.write(this.GLOBAL_PLUGINS_KEY, JSON.stringify(ids)); } catch { this.write(this.GLOBAL_PLUGINS_KEY, JSON.stringify(ids)); }
  }

  async getWorkspacePluginIds(vaultId: string): Promise<string[]> {
    try { const invoke = await this.getInvoke(); const raw = await invoke('get_workspace_plugin_ids', { vault_id: vaultId }); return raw && raw.length ? JSON.parse(raw) : []; } catch { const raw = this.read(`${this.WORKSPACE_PLUGINS_PREFIX}${vaultId}`); return raw && raw.length ? JSON.parse(raw) : []; }
  }
  async saveWorkspacePluginIds(vaultId: string, ids: string[]): Promise<void> {
    try { const invoke = await this.getInvoke(); await invoke('save_workspace_plugin_ids', { vault_id: vaultId, json: JSON.stringify(ids) }); this.write(`${this.WORKSPACE_PLUGINS_PREFIX}${vaultId}`, JSON.stringify(ids)); } catch { this.write(`${this.WORKSPACE_PLUGINS_PREFIX}${vaultId}`, JSON.stringify(ids)); }
  }

  async getInstalledRemotePlugins(): Promise<{ id: string; code: string; manifestUrl: string }[]> {
    try { const invoke = await this.getInvoke(); const raw = await invoke('get_installed_remote_plugins'); return raw && raw.length ? JSON.parse(raw) : []; } catch { const raw = this.read(this.REMOTE_PLUGINS_KEY); return raw && raw.length ? JSON.parse(raw) : []; }
  }
  async saveInstalledRemotePlugin(plugin: { id: string; code: string; manifestUrl: string }): Promise<void> {
    try { const invoke = await this.getInvoke(); await invoke('save_installed_remote_plugin', { json: JSON.stringify(plugin) }); } catch { const raw = this.read(this.REMOTE_PLUGINS_KEY); const arr = raw && raw.length ? JSON.parse(raw) : []; const idx = arr.findIndex((p: any) => p.id === plugin.id); if (idx >= 0) arr[idx] = plugin; else arr.push(plugin); this.write(this.REMOTE_PLUGINS_KEY, JSON.stringify(arr)); }
  }
  async removeInstalledRemotePlugin(id: string): Promise<void> {
    try { const invoke = await this.getInvoke(); await invoke('remove_installed_remote_plugin', { id }); } catch { const raw = this.read(this.REMOTE_PLUGINS_KEY); if (!raw) return; const arr = JSON.parse(raw).filter((p: any) => p.id !== id); this.write(this.REMOTE_PLUGINS_KEY, JSON.stringify(arr)); }
  }

  async getAIDockConfig(): Promise<{ url: string; name: string } | null> {
    try { const invoke = await this.getInvoke(); const raw = await invoke('get_ai_dock_config'); return raw && raw.length ? JSON.parse(raw) : null; } catch { const raw = this.read(this.AI_DOCK_CONFIG_KEY); return raw && raw.length ? JSON.parse(raw) : null; }
  }
  async saveAIDockConfig(config: { url: string; name: string } | null): Promise<void> { try { const invoke = await this.getInvoke(); if (config) await invoke('save_ai_dock_config', { json: JSON.stringify(config) }); else await invoke('save_ai_dock_config', { json: '' }); if (config) this.write(this.AI_DOCK_CONFIG_KEY, JSON.stringify(config)); else this.write(this.AI_DOCK_CONFIG_KEY, ''); } catch { if (config) this.write(this.AI_DOCK_CONFIG_KEY, JSON.stringify(config)); else this.write(this.AI_DOCK_CONFIG_KEY, ''); } }

  async getPreference(key: string): Promise<string | null> { try { const invoke = await this.getInvoke(); const raw = await invoke('get_preference', { key }); return raw && raw.length ? raw : null; } catch { const prefsRaw = this.read(this.PREFERENCES_KEY); try { const prefs = prefsRaw ? JSON.parse(prefsRaw) : {}; return prefs[key] || null; } catch { return null; } } }
  async savePreference(key: string, value: string): Promise<void> { try { const invoke = await this.getInvoke(); await invoke('save_preference', { key, value }); const prefsRaw = this.read(this.PREFERENCES_KEY); const prefs = prefsRaw ? JSON.parse(prefsRaw) : {}; prefs[key] = value; this.write(this.PREFERENCES_KEY, JSON.stringify(prefs)); } catch { const prefsRaw = this.read(this.PREFERENCES_KEY); const prefs = prefsRaw ? JSON.parse(prefsRaw) : {}; prefs[key] = value; this.write(this.PREFERENCES_KEY, JSON.stringify(prefs)); } }

  async getVaultRootPath(): Promise<string | null> { try { const invoke = await this.getInvoke(); const raw = await invoke('get_vault_root_path'); return raw && raw.length ? raw : null; } catch { const raw = this.read(this.VAULT_ROOT_KEY); return raw && raw.length ? raw : null; } }
  async setVaultRootPath(path: string | null): Promise<void> { try { const invoke = await this.getInvoke(); if (path === null) await invoke('set_vault_root_path', { path: '' }); else await invoke('set_vault_root_path', { path }); if (path === null) this.write(this.VAULT_ROOT_KEY, null); else this.write(this.VAULT_ROOT_KEY, path); } catch { if (path === null) this.write(this.VAULT_ROOT_KEY, null); else this.write(this.VAULT_ROOT_KEY, path); } }
}


/* -------------------------------------------------------------------------- */
/*                             Tauri-backed adapter                            */
/* -------------------------------------------------------------------------- */
/**
 * Adapter that delegates to Tauri Rust commands via `invoke`.
 * We dynamically import the module at runtime so the same bundle can run in
 * the web (where the module might be absent). Use `/* @vite-ignore` so
 * Vite doesn't eagerly try to resolve the native dependency.
 */
class TauriStorageAdapter implements IStorageAdapter {
  private async invokeFn(): Promise<(cmd: string, payload?: any) => Promise<any>> {
    // Assume the Tauri runtime is already injected in the webview when this
    // adapter is instantiated. The proxy is responsible for switching to
    // this adapter only when `window.__TAURI__` is present. If for some
    // reason it's not available, throw so callers receive an immediate
    // failure and can handle it.
    if (typeof (window as any).__TAURI__ === "undefined") {
      throw new Error("Tauri runtime not available");
    }

    const mod = await import(/* @vite-ignore */ "@tauri-apps/api/tauri");
    // `invoke` may be named or default-shaped depending on package shape
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
      // POSIX absolute
      if (p.startsWith('/')) return true;
      // Windows absolute: C:\ or C:/ or UNC \\server\
      if (/^[A-Za-z]:[\\/]/.test(p)) return true;
      if (p.startsWith('\\\\')) return true;
      return false;
    };

    if (isAbsolute(path)) {
      // Ask Rust to create a vault that points to an absolute path. Rust will
      // register the vault in vaults.json and create an app-managed tree
      // placeholder. After that, write the default tree into the vault folder
      // using the existing save_tree command so state lives under <vault>/.focosx.
      const id = await invoke('create_vault_at_path', { name, path });
      // write default tree into the vault-local .focosx/tree.json
      await invoke('save_tree', { vault_id: id, json: JSON.stringify(ensureDefaultStructure([])) });
      const raw = await invoke('get_vaults');
      const arr = raw && raw.length ? JSON.parse(raw) : [];
      const found = arr.find((v: any) => v.id === id);
      if (found) return found as Vault;
      // fallback: return a best-effort object
      return { id, name, path, createdAt: Date.now() } as Vault;
    }

    // Non-absolute path: keep previous behavior (app-managed vault)
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
    await invoke('save_tree', { vault_id: newVault.id, json: JSON.stringify(ensureDefaultStructure([])) });
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
    await invoke("save_tree", { vault_id: vaultId, json: JSON.stringify(tree) });
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
    const payload = typeof content === "string" ? content : JSON.stringify(content);
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
    await invoke("save_workspace_plugin_ids", { vault_id: vaultId, json: JSON.stringify(ids) });
  }

  async getInstalledRemotePlugins(): Promise<{ id: string; code: string; manifestUrl: string }[]> {
    const invoke = await this.invokeFn();
    const raw = await invoke("get_installed_remote_plugins");
    return raw && raw.length ? JSON.parse(raw) : [];
  }
  async saveInstalledRemotePlugin(plugin: { id: string; code: string; manifestUrl: string }): Promise<void> {
    const invoke = await this.invokeFn();
    await invoke("save_installed_remote_plugin", { json: JSON.stringify(plugin) });
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
  async saveAIDockConfig(config: { url: string; name: string } | null): Promise<void> {
    const invoke = await this.invokeFn();
    if (config) await invoke("save_ai_dock_config", { json: JSON.stringify(config) });
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

/* -------------------------------------------------------------------------- */
/*                              Proxy / Export                                 */
/* -------------------------------------------------------------------------- */
/**
 * Proxy adapter that always prefers Tauri when available, otherwise uses in-memory.
 * The proxy forwards calls to the active adapter. It polls shortly for Tauri
 * on construction but DOES NOT fall back to localStorage — web builds remain
 * in-memory-only unless Tauri is present.
 */
class ProxyStorage implements IStorageAdapter {
  private delegate: IStorageAdapter;
  private switched = false;
  private readonly TIMEOUT_MS = 5000; // poll timeout for the Tauri runtime
  constructor() {
    // Try to detect a usable `@tauri-apps/api/tauri` module first. Some
    // dev setups inject a web stub that throws on `invoke`; avoid starting
    // with a Tauri delegate if the imported module looks like that stub.
    (async () => {
      try {
        const mod = await import(/* @vite-ignore */ "@tauri-apps/api/tauri");
        const invoke = (mod.invoke ?? (mod.default && mod.default.invoke)) as any;
        if (typeof invoke === 'function' && typeof (window as any).__TAURI__ !== 'undefined') {
          try {
            // call a safe ping command to ensure the native runtime responds
            const res = await invoke('ping');
            if (res === 'pong') {
              this.delegate = new FileAdapterV2();
              this.switched = true;
              console.info('Storage: using FileAdapterV2 (Tauri ping OK).');
              return;
            }
          } catch (e) {
            // ping failed; treat as stub
            console.warn('Storage: ping to Tauri failed (treating as stub)', e);
          }
        }
      } catch (e) {
        // import failed or module is not resolvable in this environment
      }

      // Fallback: start in-memory and poll briefly for a usable Tauri runtime
      this.delegate = new InMemoryAdapter();
      const available = await waitForTauri(this.TIMEOUT_MS);
      if (available) {
        this.switchToTauri().catch((e) => console.warn('storage: switchToTauri error', e));
      } else {
        console.info('Tauri not detected within timeout — running in in-memory mode.');
      }
    })();
  }

  private async waitForTauriAndMaybeSwitch() {
    const available = await waitForTauri(this.TIMEOUT_MS);
    if (available) {
      await this.switchToTauri().catch((e) => console.warn('storage: switchToTauri error', e));
    } else {
      console.info(
        "Tauri not detected within timeout — running in non-persistent in-memory mode. Install or run the Desktop app to persist data to disk.",
      );
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
      if (this.isTauriError(e) && !(this.delegate instanceof InMemoryAdapter)) {
        console.warn('Storage: detected Tauri stub error; switching to in-memory adapter.', e);
        this.delegate = new InMemoryAdapter();
        this.switched = true;
        try {
          return await fn(this.delegate);
        } catch (inner) {
          // fall through to throw original
        }
      }
      throw e;
    }
  }

  /**
   * When Tauri becomes available, switch to the Tauri adapter and attempt to
   * migrate any legacy focosx_ localStorage keys into the Rust-backed filesystem.
   *
   * Migration is best-effort and will not throw; failures are logged and the
   * app will continue functioning.
   */
  private async switchToTauri() {
    try {
      const tauriAdapter = new FileAdapterV2();

      // Try a best-effort migration of legacy localStorage keys into Tauri FS.
      try {
        const mod = await import(/* @vite-ignore */ "@tauri-apps/api/tauri");
        const invoke = (mod.invoke ?? (mod.default && mod.default.invoke)) as (
          cmd: string,
          payload?: any,
        ) => Promise<any>;

        const migrateKey = async (key: string, cmd: string, payloadKey?: string) => {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) return;
            const payload: any = {};
            payload[payloadKey ?? "json"] = raw;
            await invoke(cmd, payload);
          } catch (e) {
            console.warn("migration: failed for key", key, e);
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
            if (raw) await invoke("save_tree", { vault_id: vaultId, json: raw });
          }
        }

        // Contents
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith("focosx_content_")) {
            const fileId = k.substring("focosx_content_".length);
            const raw = localStorage.getItem(k);
            if (raw) await invoke("save_file_content", { file_id: fileId, json: raw });
          }
        }

        // Global plugins
        await migrateKey("focosx_global_plugins", "save_global_plugin_ids", "json");

        // Workspace plugins
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith("focosx_workspace_plugins_")) {
            const vaultId = k.substring("focosx_workspace_plugins_".length);
            const raw = localStorage.getItem(k);
            if (raw) await invoke("save_workspace_plugin_ids", { vault_id: vaultId, json: raw });
          }
        }

        // Remote plugins
        const remRaw = localStorage.getItem("focosx_remote_plugins_source");
        if (remRaw) {
          try {
            const arr = JSON.parse(remRaw);
            if (Array.isArray(arr)) {
              for (const p of arr) {
                await invoke("save_installed_remote_plugin", { json: JSON.stringify(p) });
              }
            } else {
              await invoke("save_installed_remote_plugin", { json: remRaw });
            }
          } catch {
            await invoke("save_installed_remote_plugin", { json: remRaw });
          }
        }

        await migrateKey("focosx_ai_dock_config", "save_ai_dock_config", "json");

        const prefsRaw = localStorage.getItem("focosx_preferences");
        if (prefsRaw) {
          try {
            const prefs = JSON.parse(prefsRaw);
            if (prefs && typeof prefs === "object") {
              for (const [k, v] of Object.entries(prefs)) {
                await invoke("save_preference", { key: k, value: String(v) });
              }
            } else {
              await invoke("save_preference", { key: "migrated_preferences", value: prefsRaw });
            }
          } catch {
            await invoke("save_preference", { key: "migrated_preferences", value: prefsRaw });
          }
        }

        // Best-effort cleanup of legacy localStorage keys so desktop no longer uses them.
        try {
          localStorage.removeItem("focosx_vaults");
          localStorage.removeItem("focosx_preferences");
        } catch {
          // ignore
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
              // ignore
            }
          }
        }
      } catch (e) {
        // migration best-effort; continue
        console.warn("migration to tauri failed:", e);
      }

      // switch delegate to Tauri adapter
      this.delegate = tauriAdapter;
      this.switched = true;
      console.info("Switched storage delegate to Tauri filesystem adapter.");
    } catch (e) {
      console.warn("failed to initialize Tauri adapter; continuing in-memory", e);
      // leave delegate as in-memory
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
  async getInstalledRemotePlugins(): Promise<{ id: string; code: string; manifestUrl: string }[]> {
    return this.exec((d) => d.getInstalledRemotePlugins());
  }
  async saveInstalledRemotePlugin(plugin: { id: string; code: string; manifestUrl: string }): Promise<void> {
    return this.exec((d) => d.saveInstalledRemotePlugin(plugin));
  }
  async removeInstalledRemotePlugin(id: string): Promise<void> {
    return this.exec((d) => d.removeInstalledRemotePlugin(id));
  }
  async getAIDockConfig(): Promise<{ url: string; name: string } | null> {
    return this.exec((d) => d.getAIDockConfig());
  }
  async saveAIDockConfig(config: { url: string; name: string } | null): Promise<void> {
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

// The canonical `storage` instance and `ensureDefaultStructure` helper are
// provided by the modularized storage implementation in `./storage/*` and
// imported above. This file acts only as a compatibility layer; the full
// implementations live inside `focosx_desktop/src/services/storage/`.
