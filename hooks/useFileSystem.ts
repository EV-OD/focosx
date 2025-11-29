
import { useState, useEffect, useCallback } from 'react';
import { FileSystemNode, FileType } from '../types';
import { storage, ensureDefaultStructure } from '../services/StorageService';

export const useFileSystem = (vaultId: string | null) => {
  const [fileTree, setFileTree] = useState<FileSystemNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
        // Ensure we have the basic structure (e.g. assets folder)
        const initializedTree = ensureDefaultStructure(tree);
        
        // If structure was modified during initialization, save it back
        if (JSON.stringify(tree) !== JSON.stringify(initializedTree)) {
           await storage.saveTree(vaultId, initializedTree);
        }
        setFileTree(initializedTree);
      } catch (err) {
        console.error("Failed to load file tree", err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [vaultId]);

  // --- Persistence Helper ---
  const saveTree = useCallback(async (newTree: FileSystemNode[]) => {
    setFileTree(newTree);
    if (vaultId) {
      await storage.saveTree(vaultId, newTree);
    }
  }, [vaultId]);

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
  }, [fileTree, saveTree]);

  const deleteNode = useCallback(async (nodeId: string) => {
    const deleteRecursive = (nodes: FileSystemNode[]): FileSystemNode[] => {
      return nodes
        .filter(n => n.id !== nodeId)
        .map(n => ({
          ...n,
          children: n.children ? deleteRecursive(n.children) : undefined
        }));
    };

    await saveTree(deleteRecursive(fileTree));
  }, [fileTree, saveTree]);

  return {
    fileTree,
    isLoading,
    getNode,
    createNode,
    deleteNode,
    updateTree: saveTree // Expose raw update if needed
  };
};
