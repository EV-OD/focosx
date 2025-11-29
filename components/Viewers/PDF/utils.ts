
import * as pdfjsLib from 'pdfjs-dist';
import { OutlineNode } from './types';

// Handle ESM/CommonJS interop
const pdfjs = (pdfjsLib as any).default ?? pdfjsLib;

export const initPDFWorker = () => {
    if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
};

export { pdfjs };

export const convertPdfOutline = async (pdfDoc: pdfjsLib.PDFDocumentProxy, items: any[]): Promise<OutlineNode[]> => {
    const nodes: OutlineNode[] = [];
    for (const item of items) {
        let pageNumber = 1;
        try {
            let dest = item.dest;
            if (typeof dest === 'string') {
                dest = await pdfDoc.getDestination(dest);
            }
            if (dest && Array.isArray(dest)) {
                const ref = dest[0];
                const index = await pdfDoc.getPageIndex(ref);
                pageNumber = index + 1;
            }
        } catch (e) {
            console.warn("Failed to resolve outline dest", e);
        }

        const children = item.items && item.items.length > 0 
            ? await convertPdfOutline(pdfDoc, item.items) 
            : [];
            
        nodes.push({
            id: crypto.randomUUID(),
            title: item.title,
            pageNumber,
            children,
            isExpanded: false
        });
    }
    return nodes;
};
