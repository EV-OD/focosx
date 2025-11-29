
import React, { useState, useMemo, useEffect } from 'react';
import { DOCS_DATA } from '../../docs/content';
import { DocPage, DocSection } from '../../docs/types';
import { Search, ChevronRight, Book, ArrowLeft, Menu, X, ArrowRight } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { SimpleMarkdown } from './SimpleMarkdown';

interface DocsViewerProps {
    onClose: () => void;
}

export const DocsViewer: React.FC<DocsViewerProps> = ({ onClose }) => {
    const [activePageId, setActivePageId] = useState<string>('introduction');
    const [searchQuery, setSearchQuery] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Flatten pages for linear navigation
    const allPages = useMemo(() => {
        const pages: DocPage[] = [];
        DOCS_DATA.forEach(cat => pages.push(...cat.pages));
        return pages;
    }, []);

    const activePageIndex = allPages.findIndex(p => p.id === activePageId);
    const activePage = allPages[activePageIndex] || allPages[0];
    const nextPage = allPages[activePageIndex + 1];

    // Scroll to top when page changes
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [activePageId]);

    const filteredCategories = useMemo(() => {
        if (!searchQuery) return DOCS_DATA;
        
        return DOCS_DATA.map(cat => ({
            ...cat,
            pages: cat.pages.filter(p => 
                p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                p.category.toLowerCase().includes(searchQuery.toLowerCase())
            )
        })).filter(cat => cat.pages.length > 0);
    }, [searchQuery]);

    const renderSection = (section: DocSection, idx: number) => {
        switch (section.type) {
            case 'text':
                return <p key={idx} className="mb-4 text-zinc-300 leading-relaxed text-sm">{section.content}</p>;
            case 'markdown':
                return <div key={idx} className="mb-4"><SimpleMarkdown content={section.content || ''} /></div>;
            case 'code':
                return (
                    <div key={idx} className="mb-6 rounded-lg overflow-hidden border border-zinc-700 bg-[#1e1e1e]">
                         <div className="px-3 py-1 bg-zinc-800 border-b border-zinc-700 text-xs text-zinc-400 font-mono flex justify-between">
                             <span>{section.language || 'javascript'}</span>
                             <span className="text-[10px] opacity-50">Read-only</span>
                         </div>
                         <Editor 
                            height={Math.min(400, (section.content?.split('\n').length || 0) * 20 + 20)}
                            defaultLanguage={section.language || 'javascript'}
                            defaultValue={section.content}
                            theme="vs-dark"
                            options={{
                                readOnly: true,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                fontSize: 13,
                                lineNumbers: 'off',
                                folding: false,
                                overviewRulerBorder: false,
                                renderLineHighlight: 'none',
                                contextmenu: false
                            }}
                         />
                    </div>
                );
            case 'note':
                return (
                    <div key={idx} className="mb-6 p-4 bg-blue-900/10 border-l-4 border-blue-500 rounded-r-lg">
                        {section.title && <h4 className="font-bold text-blue-400 mb-2 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400" />{section.title}</h4>}
                        <div className="text-zinc-300 text-sm">
                            <SimpleMarkdown content={section.content || ''} />
                        </div>
                    </div>
                );
            case 'table':
                if (!section.tableData) return null;
                return (
                    <div key={idx} className="mb-6 overflow-x-auto border border-zinc-800 rounded-lg shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-900 text-zinc-400 font-medium">
                                <tr>
                                    {section.tableData.columns.map(col => (
                                        <th key={col.key} className="px-4 py-3 border-b border-zinc-800">{col.header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {section.tableData.rows.map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-zinc-900/50 transition-colors">
                                        {section.tableData!.columns.map(col => (
                                            <td key={col.key} className="px-4 py-3 text-zinc-300 font-mono text-xs">
                                                {row[col.key]}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[300] bg-[#09090b] text-zinc-200 flex flex-col font-sans">
            {/* Header */}
            <div className="h-14 border-b border-zinc-800 bg-[#09090b] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Book className="w-5 h-5 text-blue-500" />
                        <span className="font-bold text-lg">Developer Docs</span>
                    </div>
                    <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 hidden sm:inline-block">v1.0</span>
                </div>
                
                <div className="flex items-center gap-2">
                     <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 text-zinc-400">
                         {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                     </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <div className={`
                    fixed md:relative inset-y-0 left-0 w-64 bg-[#0c0c0e] border-r border-zinc-800 transform transition-transform duration-200 z-20 pt-14 md:pt-0 flex flex-col
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                `}>
                    <div className="p-4 border-b border-zinc-800 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input 
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none placeholder-zinc-600 transition-colors"
                                placeholder="Search docs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="overflow-y-auto flex-1 p-2">
                        {filteredCategories.map(cat => (
                            <div key={cat.id} className="mb-6">
                                <h3 className="px-3 text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">{cat.title}</h3>
                                <div className="space-y-0.5">
                                    {cat.pages.map(page => (
                                        <button
                                            key={page.id}
                                            onClick={() => { setActivePageId(page.id); setIsMobileMenuOpen(false); }}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${activePageId === page.id ? 'bg-blue-600/10 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
                                        >
                                            <span className="truncate">{page.title}</span>
                                            {activePageId === page.id && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-[#09090b] scroll-smooth">
                    <div className="max-w-4xl mx-auto px-8 py-12 flex flex-col min-h-full">
                        <div className="mb-8 pb-8 border-b border-zinc-800">
                            <div className="flex items-center gap-2 text-xs text-blue-500 font-medium mb-2">
                                <span>{activePage.category}</span>
                                <ChevronRight className="w-3 h-3" />
                                <span>{activePage.title}</span>
                            </div>
                            <h1 className="text-4xl font-bold text-zinc-100 mb-4">{activePage.title}</h1>
                        </div>

                        <div className="space-y-4 flex-1">
                            {activePage.sections.map((section, idx) => renderSection(section, idx))}
                        </div>

                        {/* Next Navigation */}
                        {nextPage && (
                            <div className="mt-16 pt-8 border-t border-zinc-800">
                                <button
                                    onClick={() => setActivePageId(nextPage.id)}
                                    className="group w-full flex items-center justify-between p-6 rounded-xl border border-zinc-800 hover:border-blue-500/50 hover:bg-zinc-900/50 transition-all text-left"
                                >
                                    <div>
                                        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Next Article</div>
                                        <div className="text-lg font-bold text-zinc-200 group-hover:text-blue-400 transition-colors">{nextPage.title}</div>
                                        <div className="text-sm text-zinc-500 mt-1">{nextPage.category}</div>
                                    </div>
                                    <div className="p-3 rounded-full bg-zinc-800 text-zinc-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                        <ArrowRight className="w-5 h-5" />
                                    </div>
                                </button>
                            </div>
                        )}
                        
                        <div className="mt-12 pt-8 border-t border-zinc-800 flex justify-between items-center">
                            <div className="text-xs text-zinc-500">
                                © 2024 FocosX Architecture
                            </div>
                            <div className="flex gap-4 text-xs text-zinc-500">
                                <span>API v1.0</span>
                                <span>Runtime: React 18</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

import { useRef } from 'react';
