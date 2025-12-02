import { FileSystemNode, Vault } from "../../types";

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

  getVaultRootPath(): Promise<string | null>;
  setVaultRootPath(path: string | null): Promise<void>;

  // Granular file operations for real filesystem
  createNode(vaultId: string, parentId: string | null, name: string, type: string): Promise<string>;
  deleteNode(vaultId: string, id: string): Promise<void>;
  renameNode(vaultId: string, id: string, newName: string): Promise<string>;
}

export default IStorageAdapter;
