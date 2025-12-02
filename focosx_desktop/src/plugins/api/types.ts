
import React, { ReactNode } from 'react';
import { FrameData, InteractionMode, Point, FileSystemNode } from '../../types';

// --- Canvas Frame Plugin Types ---

export interface CustomToolConfig {
    id: string;
    type: 'brush' | 'eraser' | 'action';
    color?: string;
    width?: number;
    opacity?: number;
    blendMode?: string;
}

export interface PluginFrameProps {
  frame: FrameData;
  isActive: boolean;
  mode: InteractionMode;
  scale: number;
  onUpdate: (updatedFrame: Partial<FrameData>) => void;
  onDelete: () => void;
  isResizing: boolean;
  isFocused?: boolean;
  customTool?: CustomToolConfig | null; 
}

export interface FrameTool {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: (frame: FrameData, updateFrame: (updates: Partial<FrameData>) => void) => void;
}

export interface GlobalTool {
    id: string;
    label: string;
    icon?: ReactNode;
    appearance: {
        type: 'brush' | 'block' | 'stamp';
        color: string;
        widthClass: string; 
        heightClass: string; 
        tipColor?: string; 
        labelColor?: string; 
    };
    onClick: (actions: {
        setMode: (mode: InteractionMode) => void;
        setCustomTool: (tool: CustomToolConfig | null) => void;
    }) => void;
    onPointerDown?: (e: React.PointerEvent, worldPos: Point) => void; 
}

export interface FrameInteractionConfig {
    dragHandle?: 'header' | 'everywhere';
    captureWheel?: boolean;
}

export interface FrameTypeDefinition {
      label: string;
      icon: ReactNode;
      component: React.FC<PluginFrameProps>;
      defaultDimensions: { width: number; height: number };
      customTools?: FrameTool[];
      handledExtensions?: string[];
      interaction?: FrameInteractionConfig;
}

// --- File Renderer Plugin Types (New) ---

export interface FileRendererProps {
    file: FileSystemNode;
    content: any; // Raw content (string, buffer, etc.)
    onSave: (newContent: any) => void;
    readOnly?: boolean;
}

export interface FileRendererDefinition {
    id: string;
    label: string;
    icon?: ReactNode;
    /**
     * File extensions this renderer handles (e.g., ['csv', 'tsv'])
     * Case insensitive, without dot.
     */
    handledExtensions: string[];
    component: React.FC<FileRendererProps>;
}

// --- Main Plugin Definition ---

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  
  /** Plugins that render as draggable items on the Canvas */
  frameTypes?: { [key: string]: FrameTypeDefinition };
  
  /** Tools that appear in the creative toolbar (brushes, stamps) */
  globalTools?: GlobalTool[];

  /** Full-screen Viewers/Editors for specific file types */
  fileRenderers?: { [key: string]: FileRendererDefinition };
}