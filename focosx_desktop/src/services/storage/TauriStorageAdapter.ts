import { FileSystemNode, Vault } from "../../types";
import IStorageAdapter from "./IStorageAdapter";

export class TauriStorageAdapter implements IStorageAdapter {
  private async invokeFn(): Promise<(cmd: string, payload?: any) => Promise<any>> {
    if (typeof (window as any).__TAURI__ === "undefined") {
      throw new Error("Tauri runtime not available");
    }

    const mod = await import(/* @vite-ignore */ "@tauri-apps/api/core");
    return mod.invoke as (
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
      if (p.startsWith('\\')) return true;
      return false;
    };

    if (isAbsolute(path)) {
      // Real filesystem vault - don't create default structure
      // The vault folder should already exist and be empty or have user files
      const id = await invoke('create_vault_at_path', { name, path });
      const raw = await invoke('get_vaults');
      const arr = raw && raw.length ? JSON.parse(raw) : [];
      try { localStorage.setItem("focosx_vaults", JSON.stringify(arr)); } catch {}
      const found = arr.find((v: any) => v.id === id);
      if (found) return found as Vault;
      return { id, name, path, createdAt: Date.now() } as Vault;
    }

    // App-managed vault - do NOT create default structure, vaults start empty
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
    try { localStorage.setItem("focosx_vaults", JSON.stringify(arr)); } catch {}
    // Initialize with empty tree
    await invoke('save_tree', { vaultId: newVault.id, json: JSON.stringify([]) });
    return newVault;
  }

  async deleteVault(id: string): Promise<void> {
    const invoke = await this.invokeFn();
    const raw = await invoke("get_vaults");
    const arr = raw && raw.length ? JSON.parse(raw) : [];
    const filtered = arr.filter((v: any) => v.id !== id);
    await invoke("save_vaults", { json: JSON.stringify(filtered) });
    try { localStorage.setItem("focosx_vaults", JSON.stringify(filtered)); } catch {}
    await invoke("delete_vault", { vaultId: id });
  }

  async loadTree(vaultId: string): Promise<FileSystemNode[]> {
    const invoke = await this.invokeFn();
    const raw = await invoke("load_tree", { vaultId });
    const s = raw || "[]";
    return JSON.parse(s);
  }
  async saveTree(vaultId: string, tree: FileSystemNode[]): Promise<void> {
    const invoke = await this.invokeFn();
    await invoke("save_tree", { vaultId, json: JSON.stringify(tree) });
  }

  async loadFileContent(fileId: string): Promise<any> {
    const invoke = await this.invokeFn();
    const raw = await invoke("load_file_content", { fileId });
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
    await invoke("save_file_content", { fileId, json: payload });
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
    const raw = await invoke("get_workspace_plugin_ids", { vaultId });
    return raw && raw.length ? JSON.parse(raw) : [];
  }
  async saveWorkspacePluginIds(vaultId: string, ids: string[]): Promise<void> {
    const invoke = await this.invokeFn();
    await invoke("save_workspace_plugin_ids", { vaultId, json: JSON.stringify(ids) });
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

  // Note: Tauri v2 auto-converts snake_case Rust params to camelCase JS params
  async createNode(vaultId: string, parentId: string | null, name: string, type: string): Promise<string> {
    const invoke = await this.invokeFn();
    return await invoke("create_node_cmd", { vaultId, parentId, name, nodeType: type });
  }

  async deleteNode(vaultId: string, id: string): Promise<void> {
    const invoke = await this.invokeFn();
    await invoke("delete_node_cmd", { vaultId, id });
  }

  async renameNode(vaultId: string, id: string, newName: string): Promise<string> {
    const invoke = await this.invokeFn();
    return await invoke("rename_node_cmd", { vaultId, id, newName });
  }
}

export default TauriStorageAdapter;
