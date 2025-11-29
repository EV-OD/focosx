
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { CanvasData, FrameData, InteractionMode, Stroke } from '../../types';
import { PluginManager } from '../../plugins/PluginManager';
import { FrameWrapper } from './FrameWrapper';
import { useTransform } from './hooks/useTransform';
import { useHistory } from './hooks/useHistory';
import { TopBar } from './ui/TopBar';
import { NavigationTools } from './ui/NavigationTools';
import { CreativeToolbar } from './ui/CreativeToolbar';
import { ContextToolbar } from './ui/ContextToolbar';
import { ContextMenu } from './ui/ContextMenu';
import { CommandPalette } from './ui/CommandPalette';
import { BRUSHES, BrushType } from './constants';
import { storage } from '../../services/StorageService';
import { Minimize2 } from 'lucide-react';
import { CustomToolConfig } from '../../plugins/api/types';
import { toPng } from 'html-to-image';
import { StrokeLayer } from './Layers/StrokeLayer';

interface CanvasBoardProps {
  data: CanvasData;
  onSave: (data: CanvasData) => void;
  onOpenPluginStore: () => void;
}

export const CanvasBoard: React.FC<CanvasBoardProps> = ({ data, onSave, onOpenPluginStore }) => {
  // --- Core State ---
  const [frames, setFrames] = useState<FrameData[]>(data.frames || []);
  const [globalStrokes, setGlobalStrokes] = useState<Stroke[]>(data.globalStrokes || []);
  
  // Refs for accessing latest state in callbacks without triggering re-renders
  const framesRef = useRef(frames);
  const strokesRef = useRef(globalStrokes);

  useEffect(() => {
    framesRef.current = frames;
    strokesRef.current = globalStrokes;
  }, [frames, globalStrokes]);

  // --- History State (Modularized) ---
  const { history, historyIndex, setHistoryIndex, setHistory, recordHistory, canUndo, canRedo } = useHistory(data.frames || [], data.globalStrokes || []);
  
  // --- Saving State ---
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const lastSavedData = useRef<string>(JSON.stringify(data));
  const saveTimeoutRef = useRef<any>(null);

  // --- Interaction State ---
  const [mode, setMode] = useState<InteractionMode>('select');
  const [selectedFrameIds, setSelectedFrameIds] = useState<Set<string>>(new Set());
  const [activeAddType, setActiveAddType] = useState<string>('sticky-note');
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, frameId: string} | null>(null);
  
  // --- Feature State ---
  const [focusedFrameId, setFocusedFrameId] = useState<string | null>(null);
  const [renamingFrameId, setRenamingFrameId] = useState<string | null>(null);
  const [commandPaletteMode, setCommandPaletteMode] = useState<'commands' | 'frames' | null>(null);
  const [isFrontDrawing, setIsFrontDrawing] = useState(false);
  const [toolbarAlignment, setToolbarAlignment] = useState<'left' | 'center' | 'right'>('center');

  // --- UI State ---
  const [globalPluginTools, setGlobalPluginTools] = useState(PluginManager.getAllGlobalTools());

  // --- Drawing State ---
  const [activeBrush, setActiveBrush] = useState<BrushType>('pen');
  const [activeColor, setActiveColor] = useState<string>(BRUSHES['pen'].color);
  
  // Dynamic Settings (Size & Opacity)
  const [brushSize, setBrushSize] = useState<number>(BRUSHES['pen'].baseWidth);
  const [brushOpacity, setBrushOpacity] = useState<number>(BRUSHES['pen'].opacity);

  const [activeCustomTool, setActiveCustomTool] = useState<CustomToolConfig | null>(null);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [drawingFrameId, setDrawingFrameId] = useState<string | null>(null); 
  const [isDrawingGlobal, setIsDrawingGlobal] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const transformLayerRef = useRef<HTMLDivElement>(null);
  
  // --- Custom Hooks ---
  const { transform, setTransform, screenToWorld, handleWheel, zoomIn, zoomOut } = useTransform(containerRef);

  // --- Init & Sync Effects ---
  useEffect(() => {
      if (data.id) {
          setFrames(data.frames || []);
          setGlobalStrokes(data.globalStrokes || []);
          setHistory([{ frames: data.frames || [], globalStrokes: data.globalStrokes || [] }]);
          setHistoryIndex(0);
          lastSavedData.current = JSON.stringify(data);
          setSaveStatus('saved');
      }
  }, [data.id]);

  useEffect(() => {
    return PluginManager.subscribe(() => {
      setGlobalPluginTools(PluginManager.getAllGlobalTools());
    });
  }, []);

  // --- Saving Logic ---

  const persist = useCallback((currentFrames: FrameData[], currentStrokes: Stroke[]) => {
      const newData = { ...data, frames: currentFrames, globalStrokes: currentStrokes };
      onSave(newData);
      lastSavedData.current = JSON.stringify(newData);
      setSaveStatus('saved');
  }, [data, onSave]);

  const triggerAutoSave = useCallback((newFrames: FrameData[], newStrokes: Stroke[]) => {
      setSaveStatus('saving');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      saveTimeoutRef.current = setTimeout(() => {
          persist(newFrames, newStrokes);
      }, 1000);
  }, [persist]);

  const triggerSaveNow = () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      persist(frames, globalStrokes);
  };

  // --- State Management ---

  // Helper to update local state, trigger auto-save, and optionally commit to history
  const updateState = useCallback((
      frameUpdate?: FrameData[] | ((prev: FrameData[]) => FrameData[]),
      strokeUpdate?: Stroke[] | ((prev: Stroke[]) => Stroke[]),
      commitHistory: boolean = false
  ) => {
      let nextFrames = framesRef.current;
      let nextStrokes = strokesRef.current;

      if (frameUpdate) {
         if (typeof frameUpdate === 'function') {
             nextFrames = frameUpdate(framesRef.current);
         } else {
             nextFrames = frameUpdate;
         }
         setFrames(nextFrames);
      }

      if (strokeUpdate) {
          if (typeof strokeUpdate === 'function') {
              nextStrokes = strokeUpdate(strokesRef.current);
          } else {
              nextStrokes = strokeUpdate;
          }
          setGlobalStrokes(nextStrokes);
      }

      setSaveStatus('unsaved');
      triggerAutoSave(nextFrames, nextStrokes);

      if (commitHistory) {
          recordHistory(nextFrames, nextStrokes);
      }
  }, [triggerAutoSave, recordHistory]);

  const undo = useCallback(() => {
      if (canUndo) {
          const newIndex = historyIndex - 1;
          const entry = history[newIndex];
          setFrames(entry.frames);
          setGlobalStrokes(entry.globalStrokes);
          setHistoryIndex(newIndex);
          triggerAutoSave(entry.frames, entry.globalStrokes);
          setSaveStatus('unsaved');
      }
  }, [history, historyIndex, canUndo, triggerAutoSave]);

  const redo = useCallback(() => {
      if (canRedo) {
          const newIndex = historyIndex + 1;
          const entry = history[newIndex];
          setFrames(entry.frames);
          setGlobalStrokes(entry.globalStrokes);
          setHistoryIndex(newIndex);
          triggerAutoSave(entry.frames, entry.globalStrokes);
          setSaveStatus('unsaved');
      }
  }, [history, historyIndex, canRedo, triggerAutoSave]);

  // --- Keyboard Shortcuts ---

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
              e.preventDefault();
              if (e.altKey) setCommandPaletteMode('commands');
              else setCommandPaletteMode('frames');
          }
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
              e.preventDefault();
              triggerSaveNow();
          }
          if (e.key === 'Escape') {
              if (focusedFrameId) setFocusedFrameId(null);
              else if (renamingFrameId) setRenamingFrameId(null);
              else if (mode !== 'select') setMode('select');
          }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
              e.preventDefault();
              if (e.shiftKey) redo();
              else undo();
          }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
              e.preventDefault();
              redo();
          }
          if (e.key === 'Delete' || e.key === 'Backspace') {
              const target = e.target as HTMLElement;
              const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
              
              if (!isInput && selectedFrameIds.size > 0) {
                  e.preventDefault();
                  const idsToDelete = Array.from(selectedFrameIds);
                  updateState(
                      (prev) => prev.filter(f => !idsToDelete.includes(f.id)),
                      undefined,
                      true
                  );
                  setSelectedFrameIds(new Set());
                  if (focusedFrameId && idsToDelete.includes(focusedFrameId)) {
                      setFocusedFrameId(null);
                  }
              }
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedFrameId, renamingFrameId, mode, selectedFrameIds, undo, redo, updateState]);

  // --- Export Logic ---
  const handleExportImage = async () => {
      if (!transformLayerRef.current) return;
      try {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          if (frames.length === 0 && globalStrokes.length === 0) {
              alert("Canvas is empty.");
              return;
          }
          frames.forEach(f => {
              minX = Math.min(minX, f.x);
              minY = Math.min(minY, f.y);
              maxX = Math.max(maxX, f.x + f.width);
              maxY = Math.max(maxY, f.y + f.height);
          });
          globalStrokes.forEach(s => {
              s.points.forEach(p => {
                  minX = Math.min(minX, p.x);
                  minY = Math.min(minY, p.y);
                  maxX = Math.max(maxX, p.x);
                  maxY = Math.max(maxY, p.y);
              });
          });
          const padding = 50;
          minX -= padding;
          minY -= padding;
          maxX += padding;
          maxY += padding;
          const width = maxX - minX;
          const height = maxY - minY;

          const node = transformLayerRef.current;
          const dataUrl = await toPng(node, {
              width: width,
              height: height,
              style: {
                  transform: `translate(${-minX}px, ${-minY}px) scale(1)`,
                  transformOrigin: 'top left',
                  width: `${width}px`,
                  height: `${height}px`,
                  background: '#09090b'
              },
              filter: (node) => {
                  if (node.classList && node.classList.contains('resize-handle')) return false;
                  if (node.classList && node.classList.contains('frame-header')) return true;
                  return true;
              }
          });
          const link = document.createElement('a');
          link.download = `${data.name || 'canvas'}-export.png`;
          link.href = dataUrl;
          link.click();
      } catch (err) {
          console.error("Export failed", err);
          alert("Failed to export canvas. Some content (like cross-origin images/iframes) might not be supported.");
      }
  };

  const handleExportFile = () => {
      const exportData: CanvasData = { ...data, frames, globalStrokes };
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${data.name || 'canvas'}.canvas`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
  };

  // --- Helpers ---
  
  const { backStrokes, frontStrokes } = useMemo(() => {
      const back: Stroke[] = [];
      const front: Stroke[] = [];
      globalStrokes.forEach(s => {
          if (s.layer === 'front') front.push(s);
          else back.push(s);
      });
      return { backStrokes: back, frontStrokes: front };
  }, [globalStrokes]);

  const getUniqueName = useCallback((baseName: string, currentFrames: FrameData[]) => {
      let name = baseName;
      let count = 1;
      while (currentFrames.some(f => f.name === name)) {
          count++;
          name = `${baseName} ${count}`;
      }
      return name;
  }, []);

  const addFrame = useCallback((typeId: string, initialContent?: any, overridePos?: {x: number, y: number}) => {
    const def = PluginManager.getFrameType(typeId);
    if (!def) return;

    let worldPos = { x: 0, y: 0 };
    if (containerRef.current) {
         if (overridePos) {
             worldPos = overridePos;
         } else {
             const rect = containerRef.current.getBoundingClientRect();
             const centerX = (rect.width / 2 - transform.x) / transform.k;
             const centerY = (rect.height / 2 - transform.y) / transform.k;
             worldPos = { x: centerX, y: centerY };
         }
    } else {
         worldPos = { x: 100, y: 100 };
    }

    const uniqueName = getUniqueName(def.label, frames);
    const newFrame: FrameData = {
      id: `frame-${Date.now()}`,
      name: uniqueName,
      type: typeId,
      x: worldPos.x - def.defaultDimensions.width / 2,
      y: worldPos.y - def.defaultDimensions.height / 2,
      width: def.defaultDimensions.width,
      height: def.defaultDimensions.height,
      content: initialContent !== undefined ? initialContent : (typeId === 'pdf-viewer' ? 'MOCK_PDF_BINARY_DATA' : ''),
      strokes: []
    };
    
    updateState((prev) => [...prev, newFrame], undefined, true);
    setSelectedFrameIds(new Set([newFrame.id]));
    setMode('select');
  }, [frames, transform, getUniqueName, updateState]); 

  const updateFrame = useCallback((id: string, updates: Partial<FrameData>) => {
    updateState((prev) => prev.map(f => f.id === id ? { ...f, ...updates } : f), undefined, false);
  }, [updateState]); 

  const persistFrames = useCallback(() => {
      recordHistory(framesRef.current, strokesRef.current);
  }, [recordHistory]);

  const deleteFrame = useCallback((id: string) => {
    updateState((prev) => prev.filter(f => f.id !== id), undefined, true);
    setSelectedFrameIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
    });
    if (focusedFrameId === id) setFocusedFrameId(null);
  }, [focusedFrameId, updateState]);

  const handleFrameContextMenu = useCallback((e: React.MouseEvent, frameId: string) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, frameId });
  }, []);

  const handleContextMenuAction = (action: string, frameId: string) => {
      if (action === 'delete') {
          deleteFrame(frameId);
          return;
      }
      if (action === 'rename') {
          setRenamingFrameId(frameId);
          return;
      }
      updateState((prev) => {
          const idx = prev.findIndex(f => f.id === frameId);
          if (idx === -1) return prev;
          const next = [...prev];
          if (action === 'bring-front') {
              const [item] = next.splice(idx, 1);
              next.push(item);
          } else if (action === 'send-back') {
              const [item] = next.splice(idx, 1);
              next.unshift(item);
          } else if (action === 'bring-forward') {
              if (idx < next.length - 1) {
                  [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
              }
          } else if (action === 'send-backward') {
              if (idx > 0) {
                  [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
              }
          }
          return next;
      }, undefined, true);
  };

  const handleSelectFrame = useCallback((id: string) => {
     if (mode === 'select') setSelectedFrameIds(new Set([id]));
  }, [mode]); 

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      const fileId = e.dataTransfer.getData('application/x-focosx-file-id');
      const fileName = e.dataTransfer.getData('application/x-focosx-file-name');
      if (!fileId || !fileName) return;

      const ext = fileName.split('.').pop() || '';
      const frameType = PluginManager.getFrameTypeForExtension(ext);

      if (frameType) {
          try {
             const content = await storage.loadFileContent(fileId);
             const worldPos = screenToWorld(e.clientX, e.clientY);
             addFrame(frameType, content, worldPos);
          } catch (err) {
              console.error("Failed to load file content for drop", err);
          }
      } else {
          alert(`No registered plugin handles .${ext} files.`);
      }
  };

  const eraseAtPoint = (x: number, y: number) => {
      const ERASE_RADIUS = 20 / transform.k;
      updateState(
          undefined,
          (prev) => prev.filter(stroke => {
            const xs = stroke.points.map(p => p.x);
            const ys = stroke.points.map(p => p.y);
            if (x < Math.min(...xs) - ERASE_RADIUS || x > Math.max(...xs) + ERASE_RADIUS ||
                y < Math.min(...ys) - ERASE_RADIUS || y > Math.max(...ys) + ERASE_RADIUS) {
                return true;
            }
            return !stroke.points.some(p => Math.hypot(p.x - x, p.y - y) < ERASE_RADIUS);
        }),
        false
      );
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 2 || focusedFrameId) return;
    if (e.button === 1 || mode === 'pan') {
        e.preventDefault();
        if (mode === 'pan') {
           (e.target as HTMLElement).setPointerCapture(e.pointerId);
           return; 
        }
    }
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    if (activeCustomTool) return;

    if (mode === 'draw') {
        e.preventDefault();
        setIsDrawingGlobal(true);
        setCurrentStroke({
            id: `stroke-${Date.now()}`,
            color: activeColor,
            width: brushSize / transform.k,
            points: [{ x, y }],
            isEraser: false,
            layer: isFrontDrawing ? 'front' : 'back'
        });
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else if (mode === 'erase') {
        e.preventDefault();
        setIsDrawingGlobal(true); 
        eraseAtPoint(x, y);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else if (mode === 'select') {
        if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('transform-layer')) {
            setSelectedFrameIds(new Set());
        }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (focusedFrameId) return;
      if (mode === 'pan' && e.buttons === 1) {
          setTransform(prev => ({ ...prev, x: prev.x + e.movementX, y: prev.y + e.movementY }));
          return;
      }
      if (!isDrawingGlobal) return;
      const { x, y } = screenToWorld(e.clientX, e.clientY);

      if (mode === 'draw' && currentStroke) {
          setCurrentStroke(prev => prev ? ({ ...prev, points: [...prev.points, { x, y }] }) : null);
      } else if (mode === 'erase') {
          eraseAtPoint(x, y);
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (focusedFrameId) return;
      if (mode === 'pan') {
           (e.target as HTMLElement).releasePointerCapture(e.pointerId);
           return;
      }
      if (!isDrawingGlobal) return;
      
      if (mode === 'draw' && currentStroke) {
          updateState(undefined, (prev) => [...prev, currentStroke], true);
      } else if (mode === 'erase') {
          persistFrames(); 
      }
      
      setIsDrawingGlobal(false);
      setCurrentStroke(null);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleInternalDrawStart = useCallback((e: React.PointerEvent, frameId: string, rect: DOMRect) => {
    if ((mode !== 'draw' && mode !== 'erase') || isFrontDrawing) return;
    if (activeCustomTool) return;
    e.stopPropagation();
    const scrollElement = document.elementFromPoint(e.clientX, e.clientY)?.closest('.overflow-y-auto');
    const scrollTop = scrollElement ? scrollElement.scrollTop : 0;
    const scrollLeft = scrollElement ? scrollElement.scrollLeft : 0;
    const x = (e.clientX - rect.left) + scrollLeft;
    const y = (e.clientY - rect.top) + scrollTop;

    if (mode === 'draw') {
        setCurrentStroke({
          id: `stroke-${Date.now()}`,
          color: activeColor,
          width: brushSize,
          points: [{ x, y }],
          isEraser: false
        });
        setDrawingFrameId(frameId);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [mode, activeColor, brushSize, isFrontDrawing, activeCustomTool]);

  const handleInternalDrawMove = useCallback((e: React.PointerEvent, frameId: string, rect: DOMRect) => {
    setDrawingFrameId(currentId => {
        if(currentId !== frameId) return currentId;
        setCurrentStroke(prev => {
             if (!prev) return null;
             e.stopPropagation();
             const scrollElement = document.elementFromPoint(e.clientX, e.clientY)?.closest('.overflow-y-auto');
             const scrollTop = scrollElement ? scrollElement.scrollTop : 0;
             const scrollLeft = scrollElement ? scrollElement.scrollLeft : 0;
             const x = (e.clientX - rect.left) + scrollLeft;
             const y = (e.clientY - rect.top) + scrollTop;
             return { ...prev, points: [...prev.points, { x, y }] };
        });
        return currentId;
    });
  }, []);

  const handleInternalDrawEnd = useCallback((e: React.PointerEvent) => {
    setDrawingFrameId(did => {
        if(did) {
            setCurrentStroke(stroke => {
                if(stroke) {
                    e.stopPropagation();
                    updateState((prev) => 
                        prev.map(f => f.id === did ? { ...f, strokes: [...f.strokes, stroke] } : f),
                        undefined,
                        true
                    );
                }
                return null;
            });
        }
        return null;
    });
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, [updateState]);

  const focusedFrame = focusedFrameId ? frames.find(f => f.id === focusedFrameId) : null;
  const FocusedComponent = focusedFrame ? PluginManager.getFrameType(focusedFrame.type)?.component : null;

  const handleSetColor = (color: string) => {
      setActiveColor(color);
      if (activeCustomTool) {
          setActiveCustomTool(prev => prev ? ({ ...prev, color }) : null);
      }
  };

  const handleSetActiveBrush = (brush: BrushType) => {
      if (mode === 'draw' && activeBrush === brush && !activeCustomTool) {
         setMode('select');
      } else {
         setActiveBrush(brush);
         setActiveCustomTool(null);
         setBrushSize(BRUSHES[brush].baseWidth);
         setBrushOpacity(BRUSHES[brush].opacity);
         setMode('draw');
      }
  };

  const handleSetActiveCustomTool = (tool: CustomToolConfig | null) => {
      if (activeCustomTool && tool && activeCustomTool.id === tool.id) {
          setActiveCustomTool(null);
          setMode('select');
          return;
      }
      
      setActiveCustomTool(tool);
      if (tool) {
          if (tool.width) setBrushSize(tool.width);
          if (tool.opacity) setBrushOpacity(tool.opacity);
          if (tool.color) {
              setActiveColor(tool.color);
          } else {
             setActiveCustomTool(prev => prev ? ({...prev, color: activeColor}) : null);
          }
      }
  };
  
  const updateToolSettings = (size: number, opacity: number) => {
      setBrushSize(size);
      setBrushOpacity(opacity);
      if (activeCustomTool) {
          setActiveCustomTool(prev => prev ? ({ ...prev, width: size, opacity, color: activeColor }) : null);
      }
  };

  return (
    <div className="flex-1 relative h-full bg-[#09090b] overflow-hidden flex flex-col select-none">
      {!focusedFrameId && (
        <>
            <TopBar 
              canvasName={data.name}
              saveStatus={saveStatus}
              activeAddType={activeAddType}
              onSetActiveAddType={setActiveAddType}
              onAddFrame={(type) => addFrame(type)}
              onSave={triggerSaveNow}
              onExportImage={handleExportImage}
              onExportFile={handleExportFile}
              onOpenPluginStore={onOpenPluginStore}
            />
            
            <NavigationTools 
              mode={mode}
              zoom={transform.k}
              onSetMode={setMode}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              isFrontDrawing={isFrontDrawing}
              onToggleFrontDrawing={() => setIsFrontDrawing(!isFrontDrawing)}
              toolbarAlignment={toolbarAlignment}
              onSetToolbarAlignment={setToolbarAlignment}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
            />

            <ContextToolbar 
              selectedFrameIds={selectedFrameIds}
              frames={frames}
              onUpdateFrame={updateFrame}
            />
        </>
      )}

      {/* Persistent Creative Toolbar - Context Aware */}
      <div className="absolute inset-0 pointer-events-none z-[60]">
        <CreativeToolbar 
            mode={mode}
            activeBrush={activeBrush}
            activeColor={activeColor}
            activeCustomTool={activeCustomTool}
            brushSize={brushSize}
            brushOpacity={brushOpacity}
            alignment={toolbarAlignment}
            isFocused={!!focusedFrameId}
            onSetMode={setMode}
            onSetActiveBrush={handleSetActiveBrush}
            onSetActiveColor={handleSetColor}
            onSetActiveCustomTool={handleSetActiveCustomTool}
            onUpdateSettings={updateToolSettings}
            globalPluginTools={globalPluginTools}
        />
      </div>

      <div 
        ref={containerRef}
        className={`flex-1 w-full h-full relative overflow-hidden touch-none 
            ${mode === 'pan' && !focusedFrameId ? 'cursor-grab active:cursor-grabbing' : ''}
            ${mode === 'draw' && !focusedFrameId ? 'cursor-crosshair' : ''}
            ${mode === 'erase' && !focusedFrameId ? 'cursor-cell' : ''}
            ${mode === 'select' && !focusedFrameId ? 'cursor-default' : ''}
        `}
        onWheel={(e) => !focusedFrameId && handleWheel(e, mode)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={e => e.preventDefault()}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
          {!focusedFrameId ? (
             <div 
                ref={transformLayerRef}
                className="absolute origin-top-left will-change-transform transform-layer"
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
                    width: '100%',
                    height: '100%'
                }}
              >
                 <div 
                    className="absolute top-[-5000px] left-[-5000px] w-[10000px] h-[10000px] pointer-events-none opacity-10"
                    style={{
                        backgroundImage: 'radial-gradient(#71717a 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                    }}
                 />
                 <svg className="absolute top-[-5000px] left-[-5000px] w-[10000px] h-[10000px] overflow-visible pointer-events-none z-0">
                     <g transform="translate(5000, 5000)">
                        <StrokeLayer 
                            strokes={backStrokes} 
                            currentStroke={currentStroke} 
                            isDrawingGlobal={isDrawingGlobal}
                            isFront={false}
                            isFrontDrawing={isFrontDrawing}
                            brushOpacity={brushOpacity}
                        />
                     </g>
                 </svg>
                 {frames.map(frame => (
                     <FrameWrapper
                        key={frame.id}
                        frame={
                            frame.id === drawingFrameId && currentStroke 
                            ? { ...frame, strokes: [...frame.strokes, currentStroke] }
                            : frame
                        }
                        mode={mode}
                        zoom={transform.k}
                        isSelected={selectedFrameIds.has(frame.id)}
                        isRenaming={renamingFrameId === frame.id}
                        isFrontDrawing={isFrontDrawing}
                        customTool={activeCustomTool}
                        onSelect={handleSelectFrame}
                        onUpdate={updateFrame}
                        onPersist={persistFrames}
                        onDelete={deleteFrame}
                        onInternalDrawStart={handleInternalDrawStart}
                        onInternalDrawMove={handleInternalDrawMove}
                        onInternalDrawEnd={handleInternalDrawEnd}
                        onContextMenu={handleFrameContextMenu}
                        onFocus={setFocusedFrameId}
                        onRenameEnd={() => setRenamingFrameId(null)}
                     />
                 ))}
                 <svg className="absolute top-[-5000px] left-[-5000px] w-[10000px] h-[10000px] overflow-visible pointer-events-none z-[60]">
                     <g transform="translate(5000, 5000)">
                        <StrokeLayer 
                            strokes={frontStrokes} 
                            currentStroke={currentStroke} 
                            isDrawingGlobal={isDrawingGlobal}
                            isFront={true}
                            isFrontDrawing={isFrontDrawing}
                            brushOpacity={brushOpacity}
                        />
                     </g>
                 </svg>
              </div>
          ) : (
              <div className="absolute inset-0 z-50 bg-[#09090b] flex flex-col animate-in fade-in duration-300">
                  <div className="h-12 border-b border-border bg-surface flex items-center justify-between px-4 shrink-0 relative z-[70]">
                      <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-blue-400 uppercase tracking-wider">Focus Mode</span>
                          <span className="text-zinc-500">/</span>
                          <span className="text-zinc-200 font-medium">{focusedFrame?.name || 'Untitled'}</span>
                      </div>
                      <button 
                        onClick={() => { setFocusedFrameId(null); setMode('select'); setActiveCustomTool(null); }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
                      >
                          <Minimize2 className="w-4 h-4" />
                          <span>Exit Focus</span>
                      </button>
                  </div>
                  <div className="flex-1 relative overflow-hidden p-0 bg-zinc-900">
                       {FocusedComponent && focusedFrame && (
                           <FocusedComponent 
                                frame={focusedFrame}
                                isActive={true}
                                mode={mode}
                                scale={1}
                                isResizing={false}
                                isFocused={true}
                                customTool={activeCustomTool}
                                onUpdate={(updates) => updateFrame(focusedFrame.id, updates)}
                                onDelete={() => deleteFrame(focusedFrame.id)}
                           />
                       )}
                  </div>
              </div>
          )}
      </div>

      {contextMenu && !focusedFrameId && (
          <ContextMenu 
              x={contextMenu.x}
              y={contextMenu.y}
              frameId={contextMenu.frameId}
              onClose={() => setContextMenu(null)}
              onAction={handleContextMenuAction}
          />
      )}

      {commandPaletteMode && (
          <CommandPalette 
             mode={commandPaletteMode}
             frames={frames}
             onClose={() => setCommandPaletteMode(null)}
             onFocusFrame={(id) => {
                 setFocusedFrameId(id);
                 setCommandPaletteMode(null);
             }}
             onAddFrame={(typeId) => {
                 addFrame(typeId);
                 setCommandPaletteMode(null);
             }}
          />
      )}
    </div>
  );
};
