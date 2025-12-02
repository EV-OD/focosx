
import React, { useState, useEffect } from 'react';
import { PluginDefinition, PluginFrameProps, FileRendererProps } from '../api/types';
import { FileText, Highlighter, Pen, BookOpen } from 'lucide-react';
import { PDFCore } from '../../components/Viewers/PDF/PDFCore';
import { PDFContent } from '../../components/Viewers/PDF/types';
import { PDFViewer } from '../../components/Viewers/MediaViewers';

const PDFFrame: React.FC<PluginFrameProps> = ({ frame, isActive, mode, onUpdate, isResizing, isFocused, scale, customTool }) => {
  // Helpers
  const getInitialContent = (): PDFContent => {
      if (!frame.content) return { fileData: '', customBookmarks: [], outline: undefined };
      if (typeof frame.content === 'object' && frame.content.fileData) {
          return frame.content as PDFContent;
      }
      // Migration from legacy string
      return { fileData: frame.content as string, customBookmarks: [], outline: undefined };
  };

  const [content, setContent] = useState<PDFContent>(getInitialContent);

  // Sync if external updates happen
  useEffect(() => {
      const incoming = getInitialContent();
      if (incoming.fileData !== content.fileData) {
          setContent(incoming);
      }
  }, [frame.content]);

  const handleContentChange = (newContent: PDFContent) => {
      setContent(newContent);
      onUpdate({ content: newContent });
  };

  const handleStrokesChange = (newStrokes: any[]) => {
      onUpdate({ strokes: newStrokes });
  };

  // Determine Sidebar State: 
  // In Focused mode, default open. In Normal mode, default closed but togglable.
  const enableSidebar = true; 

  return (
      <PDFCore 
        content={content}
        onContentChange={handleContentChange}
        fileName={frame.name || 'Document.pdf'}
        strokes={frame.strokes}
        onStrokesChange={handleStrokesChange}
        width={frame.width}
        height={frame.height}
        scale={isFocused ? 1 : scale}
        readOnly={false}
        customTool={customTool}
        enableSidebar={enableSidebar}
        mode={mode}
      />
  );
};

// V1 File Renderer Wrapper
const PDFRendererV1: React.FC<FileRendererProps> = ({ file, content, onSave }) => {
    return <PDFViewer content={content} fileName={file.name} onSave={onSave} />;
};

export const PDFPlugin: PluginDefinition = {
  id: 'core-pdf-viewer',
  name: 'PDF Viewer',
  version: '1.5.0',
  frameTypes: {
    'pdf-viewer': {
      label: 'PDF',
      icon: <FileText className="w-4 h-4" />,
      component: PDFFrame,
      defaultDimensions: { width: 500, height: 700 },
      handledExtensions: ['pdf'],
      interaction: { captureWheel: true, dragHandle: 'header' },
      customTools: []
    }
  },
  fileRenderers: {
      'pdf-viewer-v1': {
          id: 'pdf-viewer-v1',
          label: 'Standard PDF Viewer',
          icon: <BookOpen className="w-4 h-4" />,
          handledExtensions: ['pdf'],
          component: PDFRendererV1
      }
  },
  globalTools: [
      {
          id: 'pdf-highlighter',
          label: 'Highlight',
          icon: <Highlighter className="w-5 h-5" />,
          appearance: { type: 'brush', color: '#fcd34d', widthClass: 'w-10', heightClass: 'h-16', tipColor: '#fcd34d', labelColor: '#000' },
          onClick: ({ setMode, setCustomTool }) => {
              setMode('draw');
              setCustomTool({ id: 'pdf-highlighter', type: 'brush', color: '#fcd34d', width: 24, opacity: 0.5 });
          }
      },
      {
          id: 'pdf-pen',
          label: 'PDF Pen',
          icon: <Pen className="w-4 h-4" />,
          appearance: { type: 'brush', color: '#ef4444', widthClass: 'w-8', heightClass: 'h-14', tipColor: '#ef4444', labelColor: '#fff' },
          onClick: ({ setMode, setCustomTool }) => {
              setMode('draw');
              setCustomTool({ id: 'pdf-pen', type: 'brush', color: '#ef4444', width: 2, opacity: 1 });
          }
      }
  ]
};
