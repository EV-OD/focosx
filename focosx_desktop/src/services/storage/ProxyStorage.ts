import IStorageAdapter from "./IStorageAdapter";
import InMemoryAdapter from "./InMemoryAdapter";
import FileAdapterV2 from "./FileAdapterV2";
import TauriStorageAdapter from "./TauriStorageAdapter";
import { waitForTauri } from "../../hooks/useTauri";

class ProxyStorage implements IStorageAdapter {
  private delegate: IStorageAdapter = new InMemoryAdapter();
  private switched = false;
  private readonly TIMEOUT_MS = 5000;
  constructor() {
    (async () => {
      try {
        const mod = await import(/* @vite-ignore */ "@tauri-apps/api/core");
        const invoke = mod.invoke as any;
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
        // ignore
      }

      const available = await waitForTauri(this.TIMEOUT_MS);
      if (available) {
        this.switchToTauri().catch((e) => console.warn('storage: switchToTauri error', e));
      } else {
        console.info('Tauri not detected within timeout — running in in-memory mode.');
      }
    })();
  }

  private isTauriError(err: any) {
    if (!err) return false;
    const msg = String(err?.message || err);
    return (
      msg.includes('[Tauri stub]') ||
      msg.includes('Tauri runtime not available') ||
      msg.includes("'@tauri-apps/api/tauri'") ||
      msg.includes("'@tauri-apps/api/core'")
    );
  }

  private async exec<T>(fn: (d: IStorageAdapter) => Promise<T>): Promise<T> {
    console.log('[ProxyStorage] exec called, delegate:', this.delegate.constructor.name, 'switched:', this.switched);
    try {
      return await fn(this.delegate);
    } catch (e) {
      console.error('[ProxyStorage] exec error:', e);
      if (this.isTauriError(e) && !(this.delegate instanceof InMemoryAdapter)) {
        console.warn('Storage: detected Tauri stub error; switching to in-memory adapter.', e);
        this.delegate = new InMemoryAdapter();
        this.switched = true;
        try {
          return await fn(this.delegate);
        } catch (inner) {
          // fall through
        }
      }
      throw e;
    }
  }

  private async switchToTauri() {
    try {
      const tauriAdapter = new FileAdapterV2();

      try {
        const mod = await import(/* @vite-ignore */ "@tauri-apps/api/core");
        const invoke = mod.invoke as (
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

        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith("focosx_tree_")) {
            const vaultId = k.substring("focosx_tree_".length);
            const raw = localStorage.getItem(k);
            if (raw) await invoke("save_tree", { vault_id: vaultId, json: raw });
          }
        }

        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith("focosx_content_")) {
            const fileId = k.substring("focosx_content_".length);
            const raw = localStorage.getItem(k);
            if (raw) await invoke("save_file_content", { file_id: fileId, json: raw });
          }
        }

        await migrateKey("focosx_global_plugins", "save_global_plugin_ids", "json");

        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith("focosx_workspace_plugins_")) {
            const vaultId = k.substring("focosx_workspace_plugins_".length);
            const raw = localStorage.getItem(k);
            if (raw) await invoke("save_workspace_plugin_ids", { vault_id: vaultId, json: raw });
          }
        }

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
        console.warn("migration to tauri failed:", e);
      }

      this.delegate = tauriAdapter;
      this.switched = true;
      console.info("Switched storage delegate to Tauri filesystem adapter.");
    } catch (e) {
      console.warn("failed to initialize Tauri adapter; continuing in-memory", e);
    }
  }

  async getVaults(): Promise<any> { return this.exec((d) => d.getVaults()); }
  async createVault(name: string, path: string): Promise<any> { return this.exec((d) => d.createVault(name, path)); }
  async deleteVault(id: string): Promise<void> { return this.exec((d) => d.deleteVault(id)); }
  async loadTree(vaultId: string): Promise<any> { return this.exec((d) => d.loadTree(vaultId)); }
  async saveTree(vaultId: string, tree: any): Promise<void> { return this.exec((d) => d.saveTree(vaultId, tree)); }
  async loadFileContent(fileId: string): Promise<any> { return this.exec((d) => d.loadFileContent(fileId)); }
  async saveFileContent(fileId: string, content: any): Promise<void> { return this.exec((d) => d.saveFileContent(fileId, content)); }
  async getGlobalPluginIds(): Promise<string[]> { return this.exec((d) => d.getGlobalPluginIds()); }
  async saveGlobalPluginIds(ids: string[]): Promise<void> { return this.exec((d) => d.saveGlobalPluginIds(ids)); }
  async getWorkspacePluginIds(vaultId: string): Promise<string[]> { return this.exec((d) => d.getWorkspacePluginIds(vaultId)); }
  async saveWorkspacePluginIds(vaultId: string, ids: string[]): Promise<void> { return this.exec((d) => d.saveWorkspacePluginIds(vaultId, ids)); }
  async getInstalledRemotePlugins(): Promise<any> { return this.exec((d) => d.getInstalledRemotePlugins()); }
  async saveInstalledRemotePlugin(plugin: any): Promise<void> { return this.exec((d) => d.saveInstalledRemotePlugin(plugin)); }
  async removeInstalledRemotePlugin(id: string): Promise<void> { return this.exec((d) => d.removeInstalledRemotePlugin(id)); }
  async getAIDockConfig(): Promise<any> { return this.exec((d) => d.getAIDockConfig()); }
  async saveAIDockConfig(config: any): Promise<void> { return this.exec((d) => d.saveAIDockConfig(config)); }
  async getPreference(key: string): Promise<string | null> { return this.exec((d) => d.getPreference(key)); }
  async savePreference(key: string, value: string): Promise<void> { return this.exec((d) => d.savePreference(key, value)); }
  async getVaultRootPath(): Promise<string | null> { return this.exec((d) => d.getVaultRootPath()); }
  async setVaultRootPath(path: string | null): Promise<void> { return this.exec((d) => d.setVaultRootPath(path)); }
  async createNode(vaultId: string, parentId: string | null, name: string, type: string): Promise<string> { return this.exec((d) => d.createNode(vaultId, parentId, name, type)); }
  async deleteNode(vaultId: string, id: string): Promise<void> { return this.exec((d) => d.deleteNode(vaultId, id)); }
  async renameNode(vaultId: string, id: string, newName: string): Promise<string> { return this.exec((d) => d.renameNode(vaultId, id, newName)); }
}

export default ProxyStorage;
