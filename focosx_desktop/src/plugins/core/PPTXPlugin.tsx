
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PluginDefinition, FileRendererProps, PluginFrameProps } from '../api/types';
import { Presentation, MonitorPlay, ChevronLeft, ChevronRight, Layout, Type, Image as ImageIcon, Box } from 'lucide-react';
import JSZip from 'jszip';

// --- Types ---

interface SlideElement {
  id: string;
  type: 'text' | 'shape' | 'image';
  text?: string;
  x: number; // Percentage (0-100)
  y: number; // Percentage (0-100)
  w: number; // Percentage (0-100)
  h: number; // Percentage (0-100)
  fontSize?: number;
  isTitle?: boolean;
}

interface SlideData {
  id: string;
  index: number;
  elements: SlideElement[];
}

// --- Parsers ---

/**
 * Parses a single slide XML string to extract text and shapes.
 * Uses DOMParser to traverse the OpenXML structure.
 */
const parseSlideXml = (xmlString: string, index: number): SlideData => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");
    const elements: SlideElement[] = [];

    // Namespaces often used in PPTX
    const aNS = "http://schemas.openxmlformats.org/drawingml/2006/main";
    const pNS = "http://schemas.openxmlformats.org/presentationml/2006/main";

    // 1. Find all Shapes (sp)
    const shapes = doc.getElementsByTagName("p:sp");
    
    // Helper to convert EMUs to Percentage (assuming default slide size ~ 9144000 x 6858000 for 4:3 or similar)
    // We'll normalize to a 100x100 coordinate space for simplicity
    const SLIDE_WIDTH_EMU = 9144000;
    const SLIDE_HEIGHT_EMU = 5143500; // 16:9 approx

    for (let i = 0; i < shapes.length; i++) {
        const shape = shapes[i];
        
        // Extract Geometry/Transform
        const xfrm = shape.getElementsByTagName("a:xfrm")[0];
        let x=0, y=0, w=0, h=0;
        
        if (xfrm) {
            const off = xfrm.getElementsByTagName("a:off")[0];
            const ext = xfrm.getElementsByTagName("a:ext")[0];
            if (off) {
                x = (parseInt(off.getAttribute("x") || "0") / SLIDE_WIDTH_EMU) * 100;
                y = (parseInt(off.getAttribute("y") || "0") / SLIDE_HEIGHT_EMU) * 100;
            }
            if (ext) {
                w = (parseInt(ext.getAttribute("cx") || "0") / SLIDE_WIDTH_EMU) * 100;
                h = (parseInt(ext.getAttribute("cy") || "0") / SLIDE_HEIGHT_EMU) * 100;
            }
        }

        // Extract Text
        const txBody = shape.getElementsByTagName("p:txBody")[0];
        if (txBody) {
            const paragraphs = txBody.getElementsByTagName("a:p");
            let fullText = "";
            for (let j = 0; j < paragraphs.length; j++) {
                const runs = paragraphs[j].getElementsByTagName("a:r");
                for (let k = 0; k < runs.length; k++) {
                    const t = runs[k].getElementsByTagName("a:t")[0];
                    if (t) fullText += t.textContent + " ";
                }
                fullText += "\n";
            }

            // Determine if it looks like a title (simple heuristic based on position or placeholders)
            const nvSpPr = shape.getElementsByTagName("p:nvSpPr")[0];
            const ph = nvSpPr?.getElementsByTagName("p:ph")[0]; // Placeholder tag
            const type = ph?.getAttribute("type");
            const isTitle = type === "title" || type === "ctrTitle";

            if (fullText.trim()) {
                elements.push({
                    id: `slide-${index}-el-${i}`,
                    type: 'text',
                    text: fullText.trim(),
                    x, y, w, h,
                    isTitle
                });
            }
        } else {
            // It's a shape without text (maybe)
            elements.push({
                id: `slide-${index}-el-${i}`,
                type: 'shape',
                x, y, w, h
            });
        }
    }

    return { id: `slide-${index}`, index, elements };
};

// --- Components ---

const SlideRenderer: React.FC<{ slide: SlideData; scale: number }> = ({ slide, scale }) => {
    return (
        <div 
            className="bg-white relative shadow-lg overflow-hidden"
            style={{ 
                width: 960 * scale, 
                height: 540 * scale, // 16:9 Aspect Ratio fixed for now
                fontSize: 16 * scale
            }}
        >
            {slide.elements.map(el => (
                <div
                    key={el.id}
                    className={`absolute flex flex-col ${el.type === 'shape' ? 'bg-zinc-200/50 border border-zinc-300' : ''}`}
                    style={{
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        width: `${el.w}%`,
                        height: `${el.h}%`,
                        // Basic positioning fallback if w/h are 0 (auto size)
                        minWidth: el.w === 0 ? 'auto' : undefined,
                        minHeight: el.h === 0 ? 'auto' : undefined
                    }}
                >
                    {el.type === 'text' && (
                        <div 
                            className={`whitespace-pre-wrap ${el.isTitle ? 'font-bold text-4xl text-black' : 'text-lg text-zinc-800'}`}
                            style={{ lineHeight: 1.2 }}
                        >
                            {el.text}
                        </div>
                    )}
                </div>
            ))}
            
            {/* Slide Number */}
            <div className="absolute bottom-2 right-4 text-xs text-zinc-400 select-none">
                {slide.index + 1}
            </div>
        </div>
    );
};

const PPTXViewer: React.FC<FileRendererProps> = ({ file, content, onSave }) => {
    const [slides, setSlides] = useState<SlideData[]>([]);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [scale, setScale] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            if (!content || typeof content !== 'string') {
                setLoading(false);
                return;
            }

            try {
                // Remove Data URL prefix if present
                const base64 = content.includes('base64,') ? content.split('base64,')[1] : content;
                const zip = await JSZip.loadAsync(base64, { base64: true });
                
                // Find slide files
                const slideFiles = Object.keys(zip.files).filter(path => path.match(/ppt\/slides\/slide\d+\.xml/));
                
                // Sort naturally (slide1, slide2, slide10...)
                slideFiles.sort((a, b) => {
                    const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || "0");
                    const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || "0");
                    return numA - numB;
                });

                const parsedSlides: SlideData[] = [];
                
                for (let i = 0; i < slideFiles.length; i++) {
                    const xmlText = await zip.file(slideFiles[i])?.async("string");
                    if (xmlText) {
                        parsedSlides.push(parseSlideXml(xmlText, i));
                    }
                }

                setSlides(parsedSlides);
                setLoading(false);
            } catch (err) {
                console.error("PPTX Load Error:", err);
                setError("Failed to parse PPTX file. Ensure it is a valid PowerPoint file.");
                setLoading(false);
            }
        };
        load();
    }, [content]);

    const activeSlide = slides[currentSlideIndex];

    if (loading) return <div className="w-full h-full flex items-center justify-center text-zinc-500">Loading Presentation...</div>;
    if (error) return <div className="w-full h-full flex items-center justify-center text-red-400">{error}</div>;

    return (
        <div className="w-full h-full flex flex-col bg-[#09090b]">
            {/* Toolbar */}
            <div className="h-12 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-2 text-zinc-200">
                    <div className="p-1.5 bg-orange-500/10 text-orange-500 rounded-md">
                        <Presentation className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-sm">{file.name}</span>
                    <span className="text-xs text-zinc-500 px-2 border-l border-zinc-700 ml-2">
                        {slides.length} Slides
                    </span>
                </div>

                <div className="flex items-center gap-2">
                     <button 
                        onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                        disabled={currentSlideIndex === 0}
                        className="p-1.5 hover:bg-zinc-800 rounded disabled:opacity-50 text-zinc-400"
                     >
                         <ChevronLeft className="w-4 h-4" />
                     </button>
                     <span className="text-xs font-mono text-zinc-400 w-12 text-center">
                         {currentSlideIndex + 1} / {slides.length}
                     </span>
                     <button 
                        onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
                        disabled={currentSlideIndex === slides.length - 1}
                        className="p-1.5 hover:bg-zinc-800 rounded disabled:opacity-50 text-zinc-400"
                     >
                         <ChevronRight className="w-4 h-4" />
                     </button>
                     
                     <div className="w-px h-4 bg-zinc-700 mx-2" />
                     
                     <button 
                         onClick={() => setScale(s => Math.max(0.2, s - 0.1))}
                         className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300"
                     >
                         -
                     </button>
                     <span className="text-xs w-12 text-center text-zinc-500">{Math.round(scale * 100)}%</span>
                     <button 
                         onClick={() => setScale(s => Math.min(2, s + 0.1))}
                         className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300"
                     >
                         +
                     </button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar Thumbnails */}
                <div className="w-48 bg-[#121214] border-r border-zinc-800 flex flex-col overflow-y-auto p-4 gap-4 shrink-0">
                    {slides.map((slide, idx) => (
                        <div 
                            key={slide.id}
                            onClick={() => setCurrentSlideIndex(idx)}
                            className={`
                                relative aspect-video bg-white rounded-sm cursor-pointer border-2 transition-all
                                ${currentSlideIndex === idx ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-transparent hover:border-zinc-600 opacity-60 hover:opacity-100'}
                            `}
                        >
                            <div className="absolute inset-0 flex flex-col p-1 overflow-hidden pointer-events-none">
                                {slide.elements.slice(0, 3).map((el, i) => (
                                    <div key={i} className="h-1 bg-zinc-200 mb-1 w-full rounded-full" style={{ width: `${Math.random() * 50 + 30}%` }} />
                                ))}
                            </div>
                            <span className="absolute bottom-1 right-1 text-[8px] text-zinc-400 font-mono">{idx + 1}</span>
                        </div>
                    ))}
                </div>

                {/* Canvas */}
                <div className="flex-1 bg-zinc-900 overflow-auto flex items-center justify-center p-8">
                     {activeSlide && (
                         <div className="shadow-2xl ring-1 ring-black/50">
                             <SlideRenderer slide={activeSlide} scale={scale} />
                         </div>
                     )}
                </div>
            </div>
        </div>
    );
};

// --- Plugin Definition ---

export const PPTXPlugin: PluginDefinition = {
    id: 'core-pptx-viewer',
    name: 'Presentation Viewer',
    version: '1.0.0',
    description: 'View PowerPoint (.pptx) presentations.',
    
    // Also provide a frame for the canvas, reusing the renderer logic but simplified
    frameTypes: {
        'pptx-frame': {
            label: 'Slide Deck',
            icon: <Presentation className="w-4 h-4" />,
            component: ({ frame }) => {
                 // Reuse renderer in read-only mode for canvas
                 return (
                     <div className="w-full h-full overflow-hidden bg-zinc-900 border border-zinc-800 flex flex-col">
                         <div className="flex-1 relative">
                             {/* Mini preview only - ideally we would reuse PPTXViewer but scaled down */}
                             <div className="absolute inset-0 flex items-center justify-center text-zinc-500 flex-col gap-2">
                                 <Presentation className="w-8 h-8 opacity-50" />
                                 <span className="text-xs">Presentation File</span>
                             </div>
                         </div>
                     </div>
                 );
            },
            defaultDimensions: { width: 400, height: 300 },
            handledExtensions: ['pptx'],
            interaction: { dragHandle: 'header' }
        }
    },

    fileRenderers: {
        'pptx-viewer': {
            id: 'pptx-main-viewer',
            label: 'Presentation Viewer',
            icon: <Presentation className="w-4 h-4" />,
            handledExtensions: ['pptx'],
            component: PPTXViewer
        }
    }
};
