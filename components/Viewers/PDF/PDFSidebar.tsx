
import React from 'react';
import { Plus, Bookmark, Trash2, List, FileText } from 'lucide-react';
import { OutlineItem } from './OutlineItem';
import { PDFContent, OutlineNode, DropPosition } from './types';

interface PDFSidebarProps {
    isOpen: boolean;
    activeTab: 'outline' | 'bookmarks';
    setActiveTab: (tab: 'outline' | 'bookmarks') => void;
    content: PDFContent;
    onContentChange: (newContent: PDFContent) => void;
    currentPage: number;
    scrollToPage: (page: number) => void;
}

export const PDFSidebar: React.FC<PDFSidebarProps> = ({ 
    isOpen, activeTab, setActiveTab, content, onContentChange, currentPage, scrollToPage 
}) => {
    
    // Handlers (kept same logic, just refined UI inside)
    const handleOutlineToggleExpand = (id: string) => {
        const toggle = (nodes: OutlineNode[]): OutlineNode[] => nodes.map(n => n.id === id ? { ...n, isExpanded: !n.isExpanded } : { ...n, children: n.children ? toggle(n.children) : [] });
        onContentChange({ ...content, outline: toggle(content.outline || []) });
    };
    const handleOutlineRename = (id: string, title: string) => {
        const rename = (nodes: OutlineNode[]): OutlineNode[] => nodes.map(n => n.id === id ? { ...n, title } : { ...n, children: n.children ? rename(n.children) : [] });
        onContentChange({ ...content, outline: rename(content.outline || []) });
    };
    const handleOutlineDelete = (id: string) => {
        const del = (nodes: OutlineNode[]): OutlineNode[] => nodes.filter(n => n.id !== id).map(n => ({ ...n, children: n.children ? del(n.children) : [] }));
        onContentChange({ ...content, outline: del(content.outline || []) });
    };
    const handleAddOutlineItem = (parentId?: string) => {
        const newItem: OutlineNode = { id: crypto.randomUUID(), title: `New Section (pg ${currentPage})`, pageNumber: currentPage, children: [], isExpanded: false };
        if (!parentId) onContentChange({ ...content, outline: [...(content.outline || []), newItem] });
        else {
            const add = (nodes: OutlineNode[]): OutlineNode[] => nodes.map(n => n.id === parentId ? { ...n, children: [...n.children, newItem], isExpanded: true } : { ...n, children: n.children ? add(n.children) : [] });
            onContentChange({ ...content, outline: add(content.outline || []) });
        }
    };
    const handleOutlineMove = (draggedId: string, targetId: string | null, position: DropPosition) => {
        let draggedNode: OutlineNode | null = null;
        const remove = (list: OutlineNode[]): OutlineNode[] => {
            const res: OutlineNode[] = [];
            for (const n of list) {
                if (n.id === draggedId) { draggedNode = n; continue; }
                if (n.children) n.children = remove(n.children);
                res.push(n);
            }
            return res;
        };
        let newTree = remove(content.outline || []);
        if (!draggedNode) return;
        
        if (targetId === null) newTree.push(draggedNode);
        else {
            const insert = (list: OutlineNode[]): OutlineNode[] => {
                const res: OutlineNode[] = [];
                for (const n of list) {
                    if (n.id === targetId) {
                        if (position === 'before') { res.push(draggedNode!); res.push(n); }
                        else if (position === 'after') { res.push(n); res.push(draggedNode!); }
                        else { res.push({ ...n, children: [...n.children, draggedNode!], isExpanded: true }); }
                    } else {
                        if (n.children) n.children = insert(n.children);
                        res.push(n);
                    }
                }
                return res;
            };
            newTree = insert(newTree);
        }
        onContentChange({ ...content, outline: newTree });
    };

    return (
        <div className={`
            flex-shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all duration-300 ease-in-out
            ${isOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 overflow-hidden'}
        `}>
            {/* Tabs */}
            <div className="flex items-center p-2 gap-1 border-b border-zinc-800 bg-zinc-900/50">
                <button 
                    onClick={() => setActiveTab('outline')} 
                    className={`
                        flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2
                        ${activeTab === 'outline' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}
                    `}
                >
                    <List className="w-3.5 h-3.5" />
                    Outline
                </button>
                <button 
                    onClick={() => setActiveTab('bookmarks')} 
                    className={`
                        flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2
                        ${activeTab === 'bookmarks' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}
                    `}
                >
                    <Bookmark className="w-3.5 h-3.5" />
                    Bookmarks
                </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-zinc-800 relative">
                {activeTab === 'outline' ? (
                    <>
                        <button 
                            onClick={() => handleAddOutlineItem()} 
                            className="w-full flex items-center justify-center gap-2 py-2 mb-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-md text-xs font-medium transition-colors border border-dashed border-zinc-700 hover:border-zinc-600"
                        >
                            <Plus className="w-3.5 h-3.5" /> 
                            Add Section (pg {currentPage})
                        </button>
                        
                        {(!content.outline || content.outline.length === 0) ? (
                            <div className="flex flex-col items-center justify-center h-32 text-zinc-600 gap-2">
                                <FileText className="w-8 h-8 opacity-20" />
                                <span className="text-xs italic">No outline items</span>
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {content.outline.map((item) => (
                                    <OutlineItem 
                                        key={item.id} 
                                        item={item} 
                                        onNavigate={scrollToPage} 
                                        onToggleExpand={handleOutlineToggleExpand} 
                                        onRename={handleOutlineRename} 
                                        onDelete={handleOutlineDelete} 
                                        onAddChild={handleAddOutlineItem} 
                                        onMove={handleOutlineMove} 
                                    />
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="space-y-2">
                         <button 
                            onClick={() => { onContentChange({ ...content, customBookmarks: [...content.customBookmarks, { id: crypto.randomUUID(), title: `Page ${currentPage}`, pageNumber: currentPage, createdAt: Date.now() }] }) }} 
                            className="w-full flex items-center justify-center gap-2 py-2 mb-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-md text-xs font-medium transition-colors border border-dashed border-zinc-700 hover:border-zinc-600"
                        >
                            <Plus className="w-3.5 h-3.5" /> 
                            Bookmark Page {currentPage}
                        </button>

                        {content.customBookmarks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-zinc-600 gap-2">
                                <Bookmark className="w-8 h-8 opacity-20" />
                                <span className="text-xs italic">No bookmarks yet</span>
                            </div>
                        ) : (
                            content.customBookmarks.map(b => (
                                <div 
                                    key={b.id} 
                                    className="group flex items-center justify-between p-2 rounded-md hover:bg-zinc-800 cursor-pointer text-sm text-zinc-300 border border-transparent hover:border-zinc-700 transition-all" 
                                    onClick={() => scrollToPage(b.pageNumber)}
                                >
                                    <div className="flex items-center gap-2 truncate min-w-0">
                                        <Bookmark className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                        <span className="truncate">{b.title}</span>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onContentChange({ ...content, customBookmarks: content.customBookmarks.filter(x => x.id !== b.id) }) }} 
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                                        title="Delete Bookmark"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
