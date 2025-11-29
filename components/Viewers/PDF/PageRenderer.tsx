
import React, { useRef, useEffect, useState } from 'react';
import { pdfjs } from './utils';
import type * as pdfjsLib from 'pdfjs-dist';

interface PageRendererProps { 
    pdfDoc: pdfjsLib.PDFDocumentProxy | null; 
    pageNum: number; 
    width: number; 
    globalScale: number; 
    internalScale: number;
    searchQuery?: string;
    activeMatchIndex?: number; // Global index of the active match
    pageMatches?: { index: number, matchText: string }[]; // Matches specific to this page
    rotation: number;
    isInteractive: boolean;
}

export const PageRenderer: React.FC<PageRendererProps> = React.memo(({ pdfDoc, pageNum, width, globalScale, internalScale, searchQuery, activeMatchIndex, pageMatches, rotation, isInteractive }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const renderTaskRef = useRef<any>(null);
    const [pageDimensions, setPageDimensions] = useState<{ w: number, h: number } | null>(null);
    const [textLayerRendered, setTextLayerRendered] = useState(false);
    
    // Canvas & Text Layer Rendering
    useEffect(() => {
        if (!pdfDoc || !canvasRef.current || !textLayerRef.current) return;
        
        let isCancelled = false;

        const renderPage = async () => {
            try {
                const page = await pdfDoc.getPage(pageNum);
                if (isCancelled) return;

                // 1. Calculate Layout Dimensions
                // "viewportUnscaled" is used to determine the aspect ratio and natural size
                const viewportUnscaled = page.getViewport({ scale: 1, rotation });
                setPageDimensions({ w: viewportUnscaled.width, h: viewportUnscaled.height });

                // "desiredCssWidth" is the actual display width of the page container in the DOM
                const desiredCssWidth = width * internalScale;
                
                // "scaleFactor" is the ratio needed to fit the PDF into that DOM width
                const scaleFactor = desiredCssWidth / viewportUnscaled.width;
                
                // 2. Setup Canvas (High Resolution for Sharpness)
                // We multiply by globalScale (canvas zoom) and dpr (retina) to get sharp pixels
                const dpr = Math.max(window.devicePixelRatio || 1, 2); 
                const canvasScale = scaleFactor * globalScale * dpr;
                const canvasViewport = page.getViewport({ scale: canvasScale, rotation });

                // 3. Setup Text Layer (Layout Resolution)
                // Text layer should match the CSS size exactly. The browser handles the zoom visual via CSS transform on parent.
                // We do NOT include globalScale or dpr here, otherwise coordinates drift.
                const textViewport = page.getViewport({ scale: scaleFactor, rotation });

                const canvas = canvasRef.current;
                const textLayer = textLayerRef.current;
                if (!canvas || !textLayer) return;

                // -- Apply Canvas Props --
                canvas.width = canvasViewport.width;
                canvas.height = canvasViewport.height;

                // -- Apply Text Layer Props --
                textLayer.style.width = '100%';
                textLayer.style.height = '100%';
                // Reset any previous transforms
                textLayer.style.transform = '';
                textLayer.style.transformOrigin = '';
                // Pass the correct scale to PDF.js CSS variables
                textLayer.style.setProperty('--scale-factor', `${textViewport.scale}`);

                const context = canvas.getContext('2d');
                if (!context) return;

                if (renderTaskRef.current) {
                    try { renderTaskRef.current.cancel(); } catch(e) {}
                }

                const renderContext = { canvasContext: context, viewport: canvasViewport };
                const task = page.render(renderContext as any);
                renderTaskRef.current = task;

                await task.promise;

                if (isCancelled) return;

                // 4. Render Text Layer Content
                const textContent = await page.getTextContent();
                if (isCancelled) return;

                textLayer.innerHTML = '';
                
                await pdfjs.renderTextLayer({
                    textContentSource: textContent,
                    container: textLayer,
                    viewport: textViewport,
                    textDivs: []
                }).promise;

                setTextLayerRendered(true);

            } catch (e: any) {
                if (e.name !== 'RenderingCancelledException') {
                    // console.error(e);
                }
            }
        };
        renderPage();

        return () => { 
            isCancelled = true; 
            if (renderTaskRef.current) {
                try { renderTaskRef.current.cancel(); } catch(e) {}
            }
        };
    }, [pdfDoc, pageNum, width, globalScale, internalScale, rotation]);

    // Highlighting Effect
    useEffect(() => {
        if (!textLayerRendered || !textLayerRef.current) return;
        const textLayer = textLayerRef.current;
        
        // 1. Clear previous highlights (simple rebuild)
        if (!searchQuery || !pageMatches || pageMatches.length === 0) {
            // Remove marks if any exist (cleanup)
            const marks = textLayer.querySelectorAll('mark');
            marks.forEach(markNode => {
                const mark = markNode as HTMLElement;
                const text = document.createTextNode(mark.textContent || '');
                mark.parentNode?.replaceChild(text, mark);
            });
            textLayer.normalize();
            return;
        }

        // 2. Apply highlights
        const spans = Array.from(textLayer.querySelectorAll('span')) as HTMLSpanElement[];
        const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

        spans.forEach(span => {
            if (!span.textContent) return;
            
            // Check if this span contains matches
            if (regex.test(span.textContent)) {
                // Use a pale/light yellow for general matches
                const html = span.textContent.replace(regex, (match) => {
                    return `<mark class="bg-yellow-300/40 text-transparent rounded-sm select-none pointer-events-none">${match}</mark>`;
                });
                span.innerHTML = html;
            }
        });

        // 3. Focus Active Match
        if (activeMatchIndex !== undefined && pageMatches.some(m => m.index === activeMatchIndex)) {
            const marks = textLayer.querySelectorAll('mark');
            if (marks.length > 0) {
                 const localIndex = pageMatches.findIndex(m => m.index === activeMatchIndex);
                 
                 // Use a strong contrasting color (Purple - Complement to Yellow) for the active match
                 if (localIndex >= 0 && marks[localIndex]) {
                     marks[localIndex].className = "bg-purple-600 text-white rounded-sm select-none pointer-events-none shadow-sm ring-1 ring-purple-700";
                     marks[localIndex].scrollIntoView({ block: 'center', behavior: 'smooth' });
                 } else if (marks[0]) {
                     // Fallback
                     marks[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
                 }
            }
        }

    }, [textLayerRendered, searchQuery, activeMatchIndex, pageMatches]);

    const desiredCssWidth = (width) * internalScale;
    const computedHeight = pageDimensions ? (desiredCssWidth / (pageDimensions.w / pageDimensions.h)) : 800;

    return (
        <div 
            data-page-number={pageNum}
            className="relative shadow-lg bg-white origin-top-left transition-transform duration-75"
            style={{ 
                width: desiredCssWidth, 
                height: computedHeight,
                marginBottom: '1rem'
            }}
        >
            <canvas ref={canvasRef} className="block w-full h-full" />
            <div 
                ref={textLayerRef} 
                className="textLayer absolute inset-0 pdf-text-layer" 
                style={{ 
                    // Enable pointer events on wrapper for smooth selection if interactive
                    pointerEvents: isInteractive ? 'auto' : 'none',
                    userSelect: 'text',
                    WebkitUserSelect: 'text'
                }} 
            />
        </div>
    );
});
