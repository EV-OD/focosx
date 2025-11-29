

import React, { useState, useEffect } from 'react';
import { FileSystemNode, FileType, CanvasData } from '../types';
import { CodeEditor } from './Editors/CodeEditor';
import { ImageViewer, PDFViewer } from './Viewers/MediaViewers';
import { CanvasBoard } from './Canvas/CanvasBoard';
import { FileText, Folder } from 'lucide-react';
import { PluginManager } from '../plugins/PluginManager';

interface FileViewerProps {
  file: FileSystemNode;
  content: any;
  onSave: (id: string, content: any) => void;
  onOpenPluginStore: () => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({ file, content, onSave, onOpenPluginStore }) => {
  const [pluginsVersion, setPluginsVersion] = useState(0);

  useEffect(() => {
    return PluginManager.subscribe(() => {
        setPluginsVersion(v => v + 1);
    });
  }, []);
  
  if (!file) return null;
  
  // --- Folder View ---
  // Do not attempt to show content for folders
  if (file.type === FileType.FOLDER) {
      return (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 bg-[#09090b]">
              <Folder className="w-16 h-16 mb-4 opacity-20" />
              <h2 className="text-xl font-medium text-zinc-500">{file.name}</h2>
              <p className="text-sm mt-2 opacity-60">Folder is empty or contains files.</p>
          </div>
      );
  }

  // If content is null/undefined, show loading
  if (content === null || content === undefined) {
      return (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
              Loading content...
          </div>
      );
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  // --- Canvas ---
  if (file.type === FileType.CANVAS) {
      return (
        <CanvasBoard 
            data={content as CanvasData} 
            onSave={(data) => onSave(file.id, data)} 
            onOpenPluginStore={onOpenPluginStore}
        />
      );
  }

  // --- Images (Built-in Viewer) ---
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
      return <ImageViewer content={content} fileName={file.name} />;
  }

  // --- Dynamic Plugin Renderers ---
  // Check preferences via PluginManager
  const fileRenderer = PluginManager.getPreferredFileRenderer(ext);

  if (fileRenderer) {
      const RendererComponent = fileRenderer.component;
      return (
          <RendererComponent 
              file={file}
              content={content}
              onSave={(newContent) => onSave(file.id, newContent)}
          />
      );
  }

  // --- Legacy Fallback for PDF (if no plugin found) ---
  if (ext === 'pdf') {
      return <PDFViewer content={content} fileName={file.name} />;
  }

  // --- Fallback: Code / Text / Markdown ---
  // If it's not handled above, we assume it's text-based and open in Monaco
  return (
    <div className="flex flex-col h-full">
        {/* Minimal Header for Text Files */}
        <div className="h-10 flex items-center px-4 bg-surface border-b border-border shrink-0">
            <FileText className="w-4 h-4 text-blue-400 mr-2" />
            <span className="text-sm text-zinc-300 font-medium">{file.name}</span>
            <div className="flex-1" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider mr-2">{ext || 'TXT'}</span>
        </div>
        <div className="flex-1 min-h-0">
            <CodeEditor 
                fileName={file.name} 
                content={typeof content === 'string' ? content : ''} 
                onChange={(val) => onSave(file.id, val)} 
            />
        </div>
    </div>
  );
};