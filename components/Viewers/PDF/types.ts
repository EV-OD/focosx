
import { Stroke, InteractionMode } from '../../../types';
import { CustomToolConfig } from '../../../plugins/api/types';

export interface CustomBookmark {
    id: string;
    title: string;
    pageNumber: number;
    createdAt: number;
}

export interface OutlineNode {
    id: string;
    title: string;
    pageNumber: number;
    children: OutlineNode[];
    isExpanded: boolean;
}

export interface PDFContent {
    fileData: string; // Base64 or URL
    customBookmarks: CustomBookmark[];
    outline?: OutlineNode[];
    pageRotations?: Record<number, number>; // Key: Page Number, Value: Degrees (0, 90, 180, 270)
}

export interface PDFCoreProps {
    content: PDFContent;
    onContentChange: (newContent: PDFContent) => void;
    fileName: string;
    strokes?: Stroke[];
    onStrokesChange?: (strokes: Stroke[]) => void;
    width: number; // Container width for layout
    height?: number;
    scale: number; // Global zoom scale (for Canvas)
    readOnly?: boolean;
    customTool?: CustomToolConfig | null;
    enableSidebar?: boolean; 
    mode?: InteractionMode;
}

export type DropPosition = 'before' | 'after' | 'inside';

export interface SearchResult {
    pageNum: number;
    matchIndex: number; // The global index of this match in the search results
    startIndexInPage: number; // Placeholder for exact character index
    matchText: string;
}

export interface SearchState {
    isOpen: boolean;
    query: string;
    results: SearchResult[]; // Flattened list of all matches
    currentResultIndex: number;
    isSearching: boolean;
}
