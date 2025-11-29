import React from 'react';

export type DocSectionType = 'text' | 'code' | 'note' | 'table' | 'markdown';

export interface DocTableCol {
    header: string;
    key: string;
}

export interface DocSection {
    type: DocSectionType;
    content?: string; // Markdown text or code
    language?: string; // For code blocks
    title?: string; // For notes
    tableData?: {
        columns: DocTableCol[];
        rows: Record<string, string>[];
    };
}

export interface DocPage {
    id: string;
    title: string;
    category: string;
    sections: DocSection[];
}

export interface DocCategory {
    id: string;
    title: string;
    pages: DocPage[];
}