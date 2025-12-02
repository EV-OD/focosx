

import React, { useState, useRef } from 'react';
import { FileSystemNode, FileType } from '../types';
import { Folder, FileText, ChevronRight, ChevronDown, Box, FilePlus, FolderPlus, Trash2, Upload, Puzzle, Settings } from 'lucide-react';
import { FileContextMenu } from './FileContextMenu';

interface FileExplorerProps {
  nodes: FileSystemNode[];
  onFileSelect: (node: FileSystemNode) => void;
  selectedFileId: string | null;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onDeleteNode: (nodeId: string) => void;
  onUploadFile: (file: File, parentId: string | null) => void;
  onOpenPluginStore: () => void;
  onOpenSettings: () => void;
}

interface FileNodeProps {
    node: FileSystemNode;
    level: number;
    selectedFileId: string | null;
    expandedFolders: Set<string>;
    toggleFolder: (e: React.MouseEvent, id: string) => void;
    onFileSelect: (node: FileSystemNode) => void;
    onContextMenu: (e: React.MouseEvent, node: FileSystemNode) => void;
}

const FileNodeItem: React.FC<FileNodeProps> = ({ 
    node, level, selectedFileId, expandedFolders, toggleFolder, onFileSelect, onContextMenu
}) => {
    const isSelected = selectedFileId === node.id;
    const isExpanded = expandedFolders.has(node.id);

    const handleDragStart = (e: React.DragEvent) => {
        e.stopPropagation();
        e.dataTransfer.setData('application/x-focosx-file-id', node.id);
        e.dataTransfer.setData('application/x-focosx-file-name', node.name);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const getIcon = (node: FileSystemNode) => {
        const ext = node.name.split('.').pop()?.toLowerCase();
        
        if (node.type === FileType.FOLDER) {
          return isExpanded ? <Folder className="w-4 h-4 text-accent" /> : <Folder className="w-4 h-4 text-zinc-600" />;
        }
        if (node.type === FileType.CANVAS) {
          return <Box className="w-4 h-4 text-purple-400" />;
        }
        if (['jpg', 'png', 'jpeg', 'gif'].includes(ext || '')) {
            return <div className="w-4 h-4 flex items-center justify-center font-bold text-[8px] border border-zinc-600 rounded text-zinc-400">IMG</div>
        }
        if (ext === 'pdf') {
            return <div className="w-4 h-4 flex items-center justify-center font-bold text-[8px] border border-red-900 bg-red-900/20 rounded text-red-400">PDF</div>
        }
        if (['js', 'ts', 'tsx', 'json', 'html'].includes(ext || '')) {
             return <div className="w-4 h-4 flex items-center justify-center font-bold text-[8px] text-blue-400">{ext?.toUpperCase().slice(0,3)}</div>
        }
        return <FileText className="w-4 h-4 text-zinc-500" />;
    };

    return (
        <div 
          draggable={node.type !== FileType.FOLDER}
          onDragStart={handleDragStart}
          className={`
            flex items-center py-1 pr-2 cursor-pointer hover:bg-zinc-800/50 transition-colors group
            ${isSelected ? 'bg-zinc-800 text-white' : 'text-text'}
          `}
          style={{ paddingLeft: `${level * 12 + 12}px` }}
          onClick={(e) => {
            onFileSelect(node);
            if (node.type === FileType.FOLDER) {
              toggleFolder(e, node.id);
            }
          }}
          onContextMenu={(e) => onContextMenu(e, node)}
        >
          <span 
            className="mr-1 opacity-70 hover:opacity-100 p-0.5 rounded"
            onClick={(e) => {
                e.stopPropagation();
                if (node.type === FileType.FOLDER) toggleFolder(e, node.id);
            }}
          >
            {node.type === FileType.FOLDER && (
              isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
            )}
            {node.type !== FileType.FOLDER && <div className="w-3 h-3" />} 
          </span>
          <span className="mr-2 shrink-0">{getIcon(node)}</span>
          <span className="text-sm truncate flex-1">{node.name}</span>
        </div>
    );
};

const renderTree = (
    nodes: FileSystemNode[] | null | undefined,
    level: number,
    props: Omit<FileNodeProps, 'node' | 'level'> & { renderChildren: any }
) => {
    if (!Array.isArray(nodes)) return null;
    return nodes.map(node => (
        <div key={node.id}>
            <FileNodeItem node={node} level={level} {...props} />
            {node.type === FileType.FOLDER && props.expandedFolders.has(node.id) && node.children && (
                props.renderChildren(node.children, level + 1, props)
            )}
        </div>
    ));
};

export const FileExplorer: React.FC<FileExplorerProps> = ({ 
  nodes, 
  onFileSelect, 
  selectedFileId,
  onCreateFile,
  onCreateFolder,
  onDeleteNode,
  onUploadFile,
  onOpenPluginStore,
  onOpenSettings
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root', 'assets-folder']));
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, fileId: string, fileName: string, fileType: FileType} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleFolder = (e: React.MouseEvent, id: string) => {
    if(e) e.stopPropagation();
    const next = new Set(expandedFolders);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedFolders(next);
  };

  const handleUploadClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          Array.from(e.target.files).forEach(file => {
              onUploadFile(file, null); 
          });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileSystemNode) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, fileId: node.id, fileName: node.name, fileType: node.type });
      onFileSelect(node);
  };

  return (
    <div className="flex flex-col h-full select-none relative">
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            onChange={handleFileChange} 
        />

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2 py-2 border-b border-border mb-2">
            <button 
                onClick={onCreateFile}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                title="New Canvas/File"
            >
                <FilePlus className="w-4 h-4" />
            </button>
            <button 
                onClick={onCreateFolder}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                title="New Folder"
            >
                <FolderPlus className="w-4 h-4" />
            </button>
            <button 
                onClick={handleUploadClick}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                title="Upload File"
            >
                <Upload className="w-4 h-4" />
            </button>
            <div className="flex-1" />
            <button 
                onClick={() => {
                    if (selectedFileId) onDeleteNode(selectedFileId);
                }}
                className={`p-1.5 rounded transition-colors ${selectedFileId ? 'text-zinc-400 hover:text-red-400 hover:bg-zinc-800' : 'text-zinc-700 cursor-default'}`}
                title="Delete Selected"
                disabled={!selectedFileId}
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto pb-4">
            {renderTree(nodes, 0, {
                selectedFileId,
                expandedFolders,
                toggleFolder,
                onFileSelect,
                onContextMenu: handleContextMenu,
                renderChildren: renderTree
            })}
        </div>

        {/* Bottom Actions */}
        <div className="border-t border-zinc-800 p-2 flex gap-1">
            <button 
                onClick={onOpenPluginStore}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="Extensions"
            >
                <Puzzle className="w-4 h-4" />
                <span className="hidden sm:inline">Ext</span>
            </button>
            <button 
                onClick={onOpenSettings}
                className="flex items-center justify-center p-2 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="Settings"
            >
                <Settings className="w-4 h-4" />
            </button>
        </div>

        {/* Context Menu Overlay */}
        {contextMenu && (
            <FileContextMenu 
                x={contextMenu.x}
                y={contextMenu.y}
                fileName={contextMenu.fileName}
                fileType={contextMenu.fileType}
                onClose={() => setContextMenu(null)}
                onDelete={() => {
                    onDeleteNode(contextMenu.fileId);
                    setContextMenu(null);
                }}
            />
        )}
    </div>
  );
};