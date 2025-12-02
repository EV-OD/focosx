
import { useState, useEffect, useCallback } from 'react';
import { FileSystemNode, FileType, Vault } from '../types';
import { storage } from '../services/StorageService';

// Check if a vault path is an absolute filesystem path
const isAbsolutePath = (path: string | undefined): boolean => {
  if (!path) return false;
  if (path.startsWith('/')) return true;
  if (/^[A-Za-z]:[\\/]/.test(path)) return true;
  if (path.startsWith('\\')) return true;
  return false;
};

export const useFileSystem = (vaultId: string | null, vault?: Vault | null) => {
  const [fileTree, setFileTree] = useState<FileSystemNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isRealFs = vault ? isAbsolutePath(vault.path) : false;
  
  console.log('[useFileSystem] hook called:', { vaultId, vaultPath: vault?.path, isRealFs });

  // --- Load Tree ---
  useEffect(() => {
    if (!vaultId) {
      setFileTree([]);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        const tree = await storage.loadTree(vaultId);
        // Vaults start empty - no default structure added
        setFileTree(tree || []);
      } catch (err) {
        console.error("Failed to load file tree", err);
        setFileTree([]);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [vaultId, isRealFs]);

  // --- Reload tree from filesystem ---
  const reloadTree = useCallback(async () => {
    if (!vaultId) return;
    setIsLoading(true);
    try {
      const tree = await storage.loadTree(vaultId);
      setFileTree(tree);
    } catch (err) {
      console.error("Failed to reload file tree", err);
    } finally {
      setIsLoading(false);
    }
  }, [vaultId]);

  // --- Persistence Helper (for non-real-fs vaults) ---
  const saveTree = useCallback(async (newTree: FileSystemNode[]) => {
    setFileTree(newTree);
    if (vaultId && !isRealFs) {
      await storage.saveTree(vaultId, newTree);
    }
  }, [vaultId, isRealFs]);

  // --- Operations ---

  const getNode = useCallback((id: string, nodes: FileSystemNode[] = fileTree): FileSystemNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = getNode(id, node.children);
        if (found) return found;
      }
    }
    return null;
  }, [fileTree]);

  const createNode = useCallback(async (
    name: string, 
    type: FileType, 
    parentId: string | null
  ) => {
    // Auto-append extension if missing
    let finalName = name;
    if (type === FileType.CANVAS && !name.endsWith('.canvas')) finalName += '.canvas';
    if (type === FileType.FILE && !name.includes('.')) finalName += '.md'; // Default to markdown

    console.log('[useFileSystem] createNode called:', { name, finalName, type, parentId, isRealFs, vaultId, vaultPath: vault?.path });

    if (isRealFs && vaultId) {
      // Use real filesystem operations
      console.log('[useFileSystem] Using real filesystem operations');
      try {
        const newId = await storage.createNode(vaultId, parentId, finalName, type);
        console.log('[useFileSystem] Created node with id:', newId);
        // Reload the tree from filesystem
        await reloadTree();
        return { id: newId, name: finalName, type, parentId, children: type === FileType.FOLDER ? [] : undefined };
      } catch (err) {
        console.error("[useFileSystem] Failed to create node on filesystem", err);
        throw err;
      }
    }

    // In-memory/app-managed vault logic
    const newNode: FileSystemNode = {
      id: crypto.randomUUID(),
      name: finalName,
      type,
      parentId,
      children: type === FileType.FOLDER ? [] : undefined
    };

    if (!parentId) {
      await saveTree([...fileTree, newNode]);
      return newNode;
    }

    const addRecursive = (nodes: FileSystemNode[]): FileSystemNode[] => {
      return nodes.map(node => {
        if (node.id === parentId) {
           // Found parent, append to children
           return { ...node, children: [...(node.children || []), newNode] };
        }
        if (node.children) {
          return { ...node, children: addRecursive(node.children) };
        }
        return node;
      });
    };

    await saveTree(addRecursive(fileTree));
    return newNode;
  }, [fileTree, saveTree, isRealFs, vaultId, reloadTree]);

  const deleteNode = useCallback(async (nodeId: string) => {
    if (isRealFs && vaultId) {
      // Use real filesystem operations
      try {
        await storage.deleteNode(vaultId, nodeId);
        // Reload the tree from filesystem
        await reloadTree();
        return;
      } catch (err) {
        console.error("Failed to delete node on filesystem", err);
        throw err;
      }
    }

    // In-memory/app-managed vault logic
    const deleteRecursive = (nodes: FileSystemNode[]): FileSystemNode[] => {
      return nodes
        .filter(n => n.id !== nodeId)
        .map(n => ({
          ...n,
          children: n.children ? deleteRecursive(n.children) : undefined
        }));
    };

    await saveTree(deleteRecursive(fileTree));
  }, [fileTree, saveTree, isRealFs, vaultId, reloadTree]);

  return {
    fileTree,
    isLoading,
    getNode,
    createNode,
    deleteNode,
    updateTree: saveTree, // Expose raw update if needed
    reloadTree, // Expose reload for manual refresh
    isRealFs // Expose whether this vault uses real filesystem
  };
};
