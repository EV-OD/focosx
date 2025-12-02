
import React, { useRef, useEffect, useState, useLayoutEffect, useMemo } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import { pdfjs, initPDFWorker, convertPdfOutline } from './utils';
import { PDFContent, PDFCoreProps, SearchResult, SearchState } from './types';
import { PageRenderer } from './PageRenderer';
import { PDFSidebar } from './PDFSidebar';
import { PDFToolbar } from './PDFToolbar';
import { PDFSearch } from './PDFSearch';

// Initialize worker
initPDFWorker();

export const PDFCore: React.FC<PDFCoreProps> = ({ 
    content, onContentChange, fileName, strokes = [], onStrokesChange, width, height, scale, readOnly = false, customTool, enableSidebar = true, mode
}) => {
    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const documentWrapperRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [internalScale, setInternalScale] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [layoutMode, setLayoutMode] = useState<'single' | 'spread'>('single');
    
    // Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(enableSidebar);
    const [activeTab, setActiveTab] = useState<'outline' | 'bookmarks'>('outline');
    
    // Drawing State
    const [currentStroke, setCurrentStroke] = useState<{points: {x:number,y:number}[], color:string, width:number, isHighlighter?:boolean} | null>(null);
    const pendingScrollRef = useRef<{left: number, top: number} | null>(null);

    // Search State
    const [search, setSearch] = useState<SearchState>({
        isOpen: false, query: '', results: [], currentResultIndex: 0, isSearching: false
    });

    // Initial Fit & Load
    useEffect(() => {
        if (!content.fileData || content.fileData === 'MOCK_PDF_BINARY_DATA') return;
        const loadPdf = async () => {
            try {
                const loadingTask = pdfjs.getDocument(content.fileData);
                const doc = await loadingTask.promise;
                setPdfDoc(doc);
                setError(null);
                if (!content.outline) {
                    const nativeOutline = await doc.getOutline();
                    onContentChange({ ...content, outline: nativeOutline ? await convertPdfOutline(doc, nativeOutline) : [] });
                }
            } catch (e) { setError("Invalid PDF Data"); }
        };
        loadPdf();
    }, [content.fileData]);

    useLayoutEffect(() => {
        if (pendingScrollRef.current && containerRef.current) {
          containerRef.current.scrollLeft = pendingScrollRef.current.left;
          containerRef.current.scrollTop = pendingScrollRef.current.top;
          pendingScrollRef.current = null;
        }
    }, [internalScale, layoutMode]);

    // Helpers
    const scrollToPage = (pageNum: number) => {
        if (!containerRef.current) return;
        const pageEl = containerRef.current.querySelector(`[data-page-number="${pageNum}"]`) as HTMLElement;
        if (pageEl) {
            pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setCurrentPage(pageNum);
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (!containerRef.current || !pdfDoc) return;
        const centerLine = e.currentTarget.scrollTop + (e.currentTarget.clientHeight / 2);
        
        // Find visible page based on center line
        const pages = Array.from(e.currentTarget.querySelectorAll('[data-page-number]'));
        let foundPage = currentPage;
        
        for (const p of pages) {
            const el = p as HTMLElement;
            if (el.offsetTop <= centerLine && (el.offsetTop + el.offsetHeight) >= centerLine) {
                foundPage = parseInt(el.dataset.pageNumber || '1', 10);
                break;
            }
        }
        if (foundPage !== currentPage) setCurrentPage(foundPage);
    };

    // --- Page Rotation ---
    const rotatePage = (direction: 'cw' | 'ccw') => {
        const currentRotation = content.pageRotations?.[currentPage] || 0;
        const delta = direction === 'cw' ? 90 : -90;
        const newRotation = (currentRotation + delta + 360) % 360;
        
        const newRotations = { ...(content.pageRotations || {}), [currentPage]: newRotation };
        onContentChange({ ...content, pageRotations: newRotations });
    };

    // --- Search Logic ---
    const runSearch = async (query: string) => {
        if (!pdfDoc || !query) {
             setSearch(prev => ({ ...prev, results: [], isSearching: false }));
             return;
        }

        setSearch(prev => ({ ...prev, isSearching: true, results: [], currentResultIndex: 0 }));

        const allMatches: SearchResult[] = [];
        const lowerQuery = query.toLowerCase();
        let globalMatchCounter = 0;

        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            const lowerPageText = pageText.toLowerCase();
            
            let startIndex = 0;
            let matchIndexInPage = lowerPageText.indexOf(lowerQuery, startIndex);
            
            while (matchIndexInPage !== -1) {
                allMatches.push({
                    pageNum: i,
                    matchIndex: globalMatchCounter++,
                    startIndexInPage: matchIndexInPage,
                    matchText: pageText.substr(matchIndexInPage, query.length) 
                });
                startIndex = matchIndexInPage + query.length;
                matchIndexInPage = lowerPageText.indexOf(lowerQuery, startIndex);
            }
        }

        setSearch(prev => ({
            ...prev,
            results: allMatches,
            isSearching: false,
            currentResultIndex: 0
        }));

        if (allMatches.length > 0) {
            scrollToPage(allMatches[0].pageNum);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (search.query.length >= 2) runSearch(search.query);
        }, 400); // Debounce
        return () => clearTimeout(timer);
    }, [search.query]);

    const nextMatch = () => {
        if (search.results.length === 0) return;
        const nextIndex = (search.currentResultIndex + 1) % search.results.length;
        setSearch(prev => ({ ...prev, currentResultIndex: nextIndex }));
        scrollToPage(search.results[nextIndex].pageNum);
    };

    const prevMatch = () => {
        if (search.results.length === 0) return;
        const prevIndex = (search.currentResultIndex - 1 + search.results.length) % search.results.length;
        setSearch(prev => ({ ...prev, currentResultIndex: prevIndex }));
        scrollToPage(search.results[prevIndex].pageNum);
    };

    // --- Zoom & Pan ---
    const performZoom = (newScale: number) => {
        setInternalScale(Math.min(Math.max(0.1, newScale), 5));
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault(); e.stopPropagation();
            performZoom(internalScale + (-e.deltaY * 0.002));
        }
    };

    // --- Drawing Handlers ---
    const strokeScale = internalScale;
    const isDrawing = !!customTool && !readOnly;

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!isDrawing || !onStrokesChange || !documentWrapperRef.current) return;
        const toolType = customTool!.id.startsWith('pdf-') ? customTool!.type : (customTool!.id === 'eraser' ? 'eraser' : 'none');
        if (toolType === 'none') return;

        e.preventDefault(); e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const rect = documentWrapperRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / strokeScale;
        const y = (e.clientY - rect.top) / strokeScale;

        if (customTool!.id === 'eraser') {
            const ERASE_RADIUS = 20 / strokeScale;
            onStrokesChange(strokes.filter(s => !s.points.some(p => Math.hypot(p.x - x, p.y - y) < ERASE_RADIUS)));
        } else {
            setCurrentStroke({ points: [{x, y}], color: customTool!.color || '#000', width: customTool!.width || 2, isHighlighter: (customTool!.opacity || 1) < 1 });
        }
    };
    const handlePointerMove = (e: React.PointerEvent) => {
        if (!currentStroke || !documentWrapperRef.current) return;
        e.stopPropagation();
        const rect = documentWrapperRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / strokeScale;
        const y = (e.clientY - rect.top) / strokeScale;
        setCurrentStroke(prev => prev ? ({ ...prev, points: [...prev.points, {x, y}] }) : null);
    };
    const handlePointerUp = (e: React.PointerEvent) => {
        if (currentStroke && onStrokesChange) {
            onStrokesChange([...strokes, { id: `stroke-${Date.now()}`, ...currentStroke, isEraser: false }]);
            setCurrentStroke(null);
        }
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    const isInteractive = !isDrawing && mode !== 'pan';

    // --- Render Loop ---
    const renderPages = useMemo(() => {
        if (!pdfDoc) return [];
        const pages = [];
        
        if (layoutMode === 'single') {
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const pageMatches = search.results.filter(r => r.pageNum === i).map(r => ({ index: r.matchIndex, matchText: r.matchText }));
                
                pages.push(
                    <div key={i} className="flex justify-center w-full">
                         <PageRenderer 
                            pdfDoc={pdfDoc} pageNum={i} width={width} globalScale={scale} internalScale={internalScale}
                            rotation={content.pageRotations?.[i] || 0}
                            searchQuery={search.query}
                            activeMatchIndex={search.results.length > 0 ? search.results[search.currentResultIndex]?.matchIndex : undefined}
                            pageMatches={pageMatches}
                            isInteractive={isInteractive}
                        />
                    </div>
                );
            }
        } else {
            for (let i = 1; i <= pdfDoc.numPages; i += 2) {
                const pg1 = i;
                const pg2 = i + 1 <= pdfDoc.numPages ? i + 1 : null;
                const spreadItemWidth = (width / 2) - 16; 

                const page1Matches = search.results.filter(r => r.pageNum === pg1).map(r => ({ index: r.matchIndex, matchText: r.matchText }));
                const page2Matches = pg2 ? search.results.filter(r => r.pageNum === pg2).map(r => ({ index: r.matchIndex, matchText: r.matchText })) : [];

                pages.push(
                    <div key={`spread-${i}`} className="flex justify-center gap-4 w-full mb-4">
                         <PageRenderer 
                            pdfDoc={pdfDoc} pageNum={pg1} width={spreadItemWidth} globalScale={scale} internalScale={internalScale}
                            rotation={content.pageRotations?.[pg1] || 0}
                            searchQuery={search.query}
                            activeMatchIndex={search.results.length > 0 ? search.results[search.currentResultIndex]?.matchIndex : undefined}
                            pageMatches={page1Matches}
                            isInteractive={isInteractive}
                        />
                         {pg2 && (
                             <PageRenderer 
                                pdfDoc={pdfDoc} pageNum={pg2} width={spreadItemWidth} globalScale={scale} internalScale={internalScale}
                                rotation={content.pageRotations?.[pg2] || 0}
                                searchQuery={search.query}
                                activeMatchIndex={search.results.length > 0 ? search.results[search.currentResultIndex]?.matchIndex : undefined}
                                pageMatches={page2Matches}
                                isInteractive={isInteractive}
                            />
                         )}
                         {!pg2 && <div style={{ width: spreadItemWidth * internalScale }} />}
                    </div>
                );
            }
        }
        return pages;
    }, [pdfDoc, layoutMode, width, scale, internalScale, content.pageRotations, search.results, search.currentResultIndex, search.query, isInteractive]);

    const injectedStyles = `
        .pdf-text-layer { 
            opacity: 1; 
            user-select: text;
            -webkit-user-select: text;
            line-height: 1.0;
        }
        .pdf-text-layer span { 
            color: transparent; 
            cursor: text;
            transform-origin: 0% 0%;
        }
        .pdf-text-layer ::selection { 
            background: #000000; 
            color: #ffffff; 
        }
    `;

    return (
        <div className="w-full h-full bg-zinc-900 flex flex-row relative overflow-hidden group border border-zinc-800 rounded-sm">
            <style>{injectedStyles}</style>
            
            {/* Sidebar */}
            <PDFSidebar 
                isOpen={isSidebarOpen}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                content={content}
                onContentChange={onContentChange}
                currentPage={currentPage}
                scrollToPage={scrollToPage}
            />

            {/* Main View */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#525659] relative">
                {/* Header */}
                <PDFToolbar 
                    fileName={fileName}
                    isSidebarOpen={isSidebarOpen}
                    onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    rotatePage={rotatePage}
                    layoutMode={layoutMode}
                    onToggleLayoutMode={() => setLayoutMode(m => m === 'single' ? 'spread' : 'single')}
                    internalScale={internalScale}
                    onZoomIn={() => performZoom(internalScale + 0.25)}
                    onZoomOut={() => performZoom(internalScale - 0.25)}
                    onToggleSearch={() => setSearch(prev => ({...prev, isOpen: !prev.isOpen}))}
                    isSearchOpen={search.isOpen}
                    enableSidebar={enableSidebar}
                />

                {/* Search Bar */}
                {search.isOpen && (
                    <PDFSearch 
                        search={search}
                        onUpdateQuery={(q) => setSearch(prev => ({ ...prev, query: q }))}
                        onClose={() => setSearch(prev => ({ ...prev, isOpen: false, query: '' }))}
                        onNext={search.results.length > 0 ? nextMatch : () => runSearch(search.query)}
                        onPrev={prevMatch}
                        onClear={() => setSearch(prev => ({ ...prev, query: '' }))}
                    />
                )}

                {/* Content Area */}
                <div 
                    ref={containerRef}
                    onScroll={handleScroll}
                    onWheel={handleWheel}
                    className={`flex-1 overflow-auto overscroll-contain relative ${isDrawing ? 'cursor-crosshair select-none' : 'cursor-text select-text'}`}
                >
                    <div className="w-fit min-w-full flex flex-col items-center py-8">
                        {!pdfDoc && !error && content.fileData !== 'MOCK_PDF_BINARY_DATA' && <div className="text-zinc-400 text-xs mt-4">Rendering PDF...</div>}
                        
                        <div 
                            ref={documentWrapperRef}
                            className="relative shadow-2xl bg-[#525659] min-h-[500px]"
                            style={{ 
                                width: width * internalScale,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                        >
                            {renderPages}

                            {/* Strokes Overlay */}
                            <div 
                                className={`absolute top-0 left-0 w-full h-full z-10 origin-top-left ${isDrawing ? 'pointer-events-auto' : 'pointer-events-none'}`}
                                style={{ transform: `scale(${strokeScale})`, width: '100%', height: '100%' }}
                            >
                                <svg className="overflow-visible" style={{ width: width - 32, height: '100%' }}>
                                    {strokes.map(stroke => (
                                        <polyline
                                            key={stroke.id}
                                            points={stroke.points.map(p => `${p.x},${p.y}`).join(' ')}
                                            fill="none"
                                            stroke={stroke.color}
                                            strokeWidth={stroke.width}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            opacity={(stroke as any).isHighlighter ? 0.5 : 1}
                                            style={{ mixBlendMode: (stroke as any).isHighlighter ? 'multiply' : 'normal' }}
                                        />
                                    ))}
                                    {currentStroke && (
                                        <polyline
                                            points={currentStroke.points.map(p => `${p.x},${p.y}`).join(' ')}
                                            fill="none"
                                            stroke={currentStroke.color}
                                            strokeWidth={currentStroke.width}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            opacity={currentStroke.isHighlighter ? 0.5 : 1}
                                            style={{ mixBlendMode: currentStroke.isHighlighter ? 'multiply' : 'normal' }}
                                        />
                                    )}
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
