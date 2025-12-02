import React, { useRef, useEffect, useState, ReactNode } from 'react';
import { PluginDefinition, PluginFrameProps, GlobalTool } from '../plugins/api/types';
import { FileText, StickyNote, Image as ImageIcon, Highlighter, Crop, Type, Stamp } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Handle ESM/CommonJS interop for pdfjs-dist
const pdfjs = (pdfjsLib as any).default ?? pdfjsLib;
// Set worker (Using the CDN link from importmap logic or explicit fallback)
if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// --- Built-in Plugins Logic ---

// 1. Sticky Note Frame
const StickyNoteFrame: React.FC<PluginFrameProps> = ({ frame, onUpdate, mode }) => {
  return (
    <div className="w-full h-full bg-yellow-100/10 border border-yellow-500/30 p-4 flex flex-col text-yellow-100 shadow-[0_0_30px_rgba(234,179,8,0.1)] backdrop-blur-sm">
      <textarea
        className={`w-full h-full bg-transparent resize-none outline-none placeholder-yellow-100/30 font-handwriting ${mode === 'draw' ? 'pointer-events-none' : 'pointer-events-auto'}`}
        value={frame.content}
        onChange={(e) => onUpdate({ content: e.target.value })}
        placeholder="Write something..."
        style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif' }}
      />
    </div>
  );
};

// 2. REAL PDF Frame
const PDFFrame: React.FC<PluginFrameProps> = ({ frame, isActive, mode, onUpdate, isResizing }) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
      const loadPdf = async () => {
          if (!frame.content || frame.content === 'MOCK_PDF_BINARY_DATA') {
              // Handle empty/mock state
              return;
          }
          try {
              const loadingTask = pdfjs.getDocument(frame.content);
              const doc = await loadingTask.promise;
              setPdfDoc(doc);
          } catch (e) {
              console.error("PDF Load Error", e);
              setError("Invalid PDF Data");
          }
      };
      loadPdf();
  }, [frame.content]);

  // Helper component to render a single page
  const PageRenderer: React.FC<{ pageNum: number; width: number }> = ({ pageNum, width }) => {
      const canvasRef = useRef<HTMLCanvasElement>(null);
      
      useEffect(() => {
          if (!pdfDoc || !canvasRef.current) return;
          
          const renderPage = async () => {
              const page = await pdfDoc.getPage(pageNum);
              
              // Calculate scale to fit width (minus padding)
              const viewportUnscaled = page.getViewport({ scale: 1 });
              const scale = (width - 32) / viewportUnscaled.width; // 32px padding
              const viewport = page.getViewport({ scale });

              const canvas = canvasRef.current;
              if (!canvas) return;

              canvas.height = viewport.height;
              canvas.width = viewport.width;

              const context = canvas.getContext('2d');
              if (!context) return;

              await page.render({
                  canvasContext: context,
                  viewport
              } as any).promise;
          };
          renderPage();
      }, [pageNum, width]); // removed pdfDoc from dependency to avoid re-triggering if doc ref changes but doc is same (unlikely)

      return <canvas ref={canvasRef} className="shadow-md mb-4 bg-white block mx-auto" />;
  };

  return (
    <div className="w-full h-full bg-zinc-900 flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="h-8 bg-zinc-800 flex items-center px-2 justify-between shrink-0 select-none">
        <span className="text-xs font-mono text-zinc-400 truncate max-w-[150px]">Document.pdf</span>
        <span className="text-[10px] bg-zinc-700 px-1 rounded text-zinc-400">
            {pdfDoc ? `${pdfDoc.numPages} pgs` : 'Loading...'}
        </span>
      </div>

      {/* Scrollable Content Area */}
      <div 
        ref={containerRef}
        className={`flex-1 overflow-y-auto relative bg-[#525659] p-4 ${mode === 'draw' ? 'cursor-crosshair' : 'cursor-default'}`}
        style={{ 
            userSelect: mode === 'draw' || isResizing ? 'none' : 'text',
            touchAction: mode === 'draw' ? 'none' : 'auto'
        }}
      >
        <div className="relative min-h-full flex flex-col items-center">
            {error && <div className="text-red-400 text-xs mt-4">{error}</div>}
            
            {!pdfDoc && !error && frame.content !== 'MOCK_PDF_BINARY_DATA' && (
                <div className="text-zinc-400 text-xs mt-4">Rendering PDF...</div>
            )}

            {/* Mock State */}
            {(!frame.content || frame.content === 'MOCK_PDF_BINARY_DATA') && (
                <div className="bg-white p-8 text-black text-center w-full h-[400px] shadow-lg flex flex-col items-center justify-center">
                    <FileText className="w-12 h-12 text-gray-300 mb-2" />
                    <p className="font-bold">Sample PDF</p>
                    <p className="text-xs text-gray-500">Upload a real file to see content.</p>
                </div>
            )}

            {/* Real Pages */}
            {pdfDoc && containerRef.current && Array.from({ length: pdfDoc.numPages }, (_, i) => (
                 <PageRenderer key={i} pageNum={i + 1} width={frame.width} />
            ))}
            
            {/* Internal Drawing Overlay */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
                 <svg className="w-full h-full overflow-visible">
                    {frame.strokes.map(stroke => (
                        <polyline
                            key={stroke.id}
                            points={stroke.points.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="none"
                            stroke={stroke.isEraser ? 'rgba(82, 86, 89, 1)' : stroke.color} // Eraser matches bg
                            strokeWidth={stroke.width}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={stroke.isEraser ? 1 : 1}
                        />
                    ))}
                 </svg>
            </div>
        </div>
      </div>
    </div>
  );
};

// --- Registry ---

class PluginRegistryImpl {
  private plugins: PluginDefinition[] = [];

  constructor() {
    // Register Core Plugin
    this.register({
      id: 'core',
      name: 'Core Tools',
      version: '1.0.0',
      frameTypes: {
        'sticky-note': {
          label: 'Note',
          icon: <StickyNote className="w-4 h-4" />,
          component: StickyNoteFrame,
          defaultDimensions: { width: 300, height: 200 },
          customTools: [
            {
                id: 'change-color',
                label: 'Change Color',
                icon: <div className="w-3 h-3 bg-yellow-400 rounded-full" />,
                onClick: () => alert('Plugin Action: Color changed!')
            }
          ]
        },
        'pdf-viewer': {
          label: 'PDF',
          icon: <FileText className="w-4 h-4" />,
          component: PDFFrame,
          defaultDimensions: { width: 500, height: 700 },
          customTools: [
              {
                  id: 'highlight',
                  label: 'Highlight',
                  icon: <Highlighter className="w-4 h-4" />,
                  onClick: () => alert('Plugin Action: Highlighter tool selected')
              }
          ]
        },
        'image': {
            label: 'Image',
            icon: <ImageIcon className="w-4 h-4" />,
            component: ({ frame }) => (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900 border border-zinc-700">
                     {frame.content ? (
                         <img src={frame.content} className="w-full h-full object-contain" alt="Frame Content" />
                     ) : (
                         <p className="text-zinc-500 text-xs">Image Placeholder</p>
                     )}
                </div>
            ),
            defaultDimensions: { width: 400, height: 300 },
            customTools: [
                {
                    id: 'crop',
                    label: 'Crop',
                    icon: <Crop className="w-4 h-4" />,
                    onClick: () => alert('Plugin Action: Crop Image')
                }
            ]
        }
      },
      // Add a Demo Global Tool
      globalTools: [
          {
              id: 'stamp',
              label: 'Stamp',
              icon: <Stamp className="w-5 h-5" />,
              appearance: {
                  type: 'brush', // Reuse brush shape but make it look like a stamp handle
                  color: '#10b981', // Emerald
                  widthClass: 'w-12',
                  heightClass: 'h-16',
                  tipColor: '#047857',
                  labelColor: '#fff'
              },
              onClick: (setMode) => {
                  // Simple Logic: Alert for now, but could set a 'stamp' mode
                  alert("Stamp Tool Selected! (Demo of Extensible Toolbar)");
                  // In a real app, this would setMode('plugin-stamp') and handle clicks in CanvasBoard
              }
          }
      ]
    });
  }

  register(plugin: PluginDefinition) {
    this.plugins.push(plugin);
  }

  getFrameType(typeId: string) {
    for (const plugin of this.plugins) {
      if (plugin.frameTypes && plugin.frameTypes[typeId]) {
        return plugin.frameTypes[typeId];
      }
    }
    return null;
  }

  getAllFrameTypes() {
    const types: Array<{ id: string; label: string; icon: ReactNode }> = [];
    this.plugins.forEach(p => {
      if (p.frameTypes) {
          Object.entries(p.frameTypes).forEach(([id, def]) => {
            types.push({ id, label: def.label, icon: def.icon });
          });
      }
    });
    return types;
  }

  getAllGlobalTools() {
      let tools: GlobalTool[] = [];
      this.plugins.forEach(p => {
          if (p.globalTools) {
              tools = [...tools, ...p.globalTools];
          }
      });
      return tools;
  }
}

export const PluginRegistry = new PluginRegistryImpl();