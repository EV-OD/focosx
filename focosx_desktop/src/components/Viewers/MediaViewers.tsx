
import React, { useEffect, useState, useRef } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { PDFCore } from './PDF/PDFCore';
import { PDFContent } from './PDF/types';

interface ViewerProps {
  content: string | PDFContent; // Can be raw base64 string or advanced object
  fileName: string;
  onSave?: (newContent: any) => void;
}

export const ImageViewer: React.FC<ViewerProps> = ({ content, fileName }) => {
  const src = typeof content === 'string' ? content : '';
  return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-950 overflow-hidden p-4 select-none">
        <div className="relative w-full h-full flex items-center justify-center">
            <img 
                src={src} 
                alt={fileName} 
                className="max-w-full max-h-full object-contain shadow-2xl" 
            />
        </div>
    </div>
  );
};

export const PDFViewer: React.FC<ViewerProps> = ({ content, fileName, onSave }) => {
    // 1. Normalize content to PDFContent object
    const [pdfData, setPdfData] = useState<PDFContent>(() => {
        if (typeof content === 'object' && content !== null && (content as any).fileData) {
            return content as PDFContent;
        }
        return { 
            fileData: typeof content === 'string' ? content : '', 
            customBookmarks: [], 
            outline: undefined 
        };
    });

    const isMock = pdfData.fileData === 'MOCK_PDF_BINARY_DATA';
    
    // 2. Measure Container for Layout
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(800);

    useEffect(() => {
        if (containerRef.current) {
            const resizeObserver = new ResizeObserver(entries => {
                for (const entry of entries) {
                    setWidth(entry.contentRect.width);
                }
            });
            resizeObserver.observe(containerRef.current);
            return () => resizeObserver.disconnect();
        }
    }, []);

    const handleContentChange = (newContent: PDFContent) => {
        setPdfData(newContent);
        if (onSave) {
            // Persist the full object structure to support bookmarks/outline in File Mode
            onSave(newContent);
        }
    };

    if (isMock) {
        return (
             <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 bg-zinc-900/50">
                <FileText className="w-16 h-16 mb-4 opacity-20" />
                <p className="font-medium text-zinc-400">Example PDF File</p>
                <p className="text-xs opacity-50 mt-1 max-w-xs text-center">
                    This is a placeholder. Upload a real PDF file to view it here.
                </p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full h-full bg-zinc-900">
             <PDFCore 
                 content={pdfData}
                 onContentChange={handleContentChange}
                 fileName={fileName}
                 width={width}
                 scale={1} // Always 1 for File Viewer mode
                 readOnly={true} // File Viewer typically implies read-only for annotation unless we add a toolbar
                 strokes={[]} 
                 enableSidebar={true}
             />
        </div>
    );
};
