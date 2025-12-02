import React, { ReactNode } from 'react';

// --- File System Types ---
export enum FileType {
  FOLDER = 'FOLDER',
  FILE = 'FILE',
  CANVAS = 'CANVAS',
}

export interface FileSystemNode {
  id: string;
  name: string;
  type: FileType;
  children?: FileSystemNode[];
  content?: any; 
  parentId?: string | null;
}

export interface Vault {
  id: string;
  name: string;
  path: string;
  createdAt: number;
}

// --- Canvas & Frame Types ---

export interface Point {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  isEraser?: boolean;
  layer?: 'front' | 'back'; // Added layer property
}

export interface FrameData {
  id: string;
  name: string; 
  type: string; 
  x: number;
  y: number;
  width: number;
  height: number;
  content: any; 
  strokes: Stroke[]; 
}

export interface CanvasData {
  id: string;
  name: string;
  frames: FrameData[];
  globalStrokes: Stroke[]; 
}

export type InteractionMode = 'select' | 'pan' | 'draw' | 'erase' | string;