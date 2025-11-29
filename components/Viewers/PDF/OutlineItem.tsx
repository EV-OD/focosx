
import React, { useState, useRef } from 'react';
import { GripVertical, ChevronDown, ChevronRight, Plus, Edit2, Trash2 } from 'lucide-react';
import { OutlineNode, DropPosition } from './types';

interface OutlineItemProps {
    item: OutlineNode;
    level?: number;
    onNavigate: (page: number) => void;
    onToggleExpand: (id: string) => void;
    onRename: (id: string, newTitle: string) => void;
    onDelete: (id: string) => void;
    onAddChild: (parentId: string) => void;
    onMove: (draggedId: string, targetId: string, position: DropPosition) => void;
}

export const OutlineItem: React.FC<OutlineItemProps> = ({ item, level = 0, onNavigate, onToggleExpand, onRename, onDelete, onAddChild, onMove }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(item.title);
    const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const hasChildren = item.children && item.children.length > 0;

    const handleRenameSubmit = () => {
        if (editValue.trim()) onRename(item.id, editValue);
        else setEditValue(item.title);
        setIsEditing(false);
    };

    const handleDragStart = (e: React.DragEvent) => {
        e.stopPropagation();
        e.dataTransfer.setData('application/x-focosx-outline-id', item.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;
        if (y < height * 0.25) setDropPosition('before');
        else if (y > height * 0.75) setDropPosition('after');
        else setDropPosition('inside');
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        const draggedId = e.dataTransfer.getData('application/x-focosx-outline-id');
        if (draggedId && draggedId !== item.id && dropPosition) {
            onMove(draggedId, item.id, dropPosition);
        }
        setDropPosition(null);
    };

    return (
        <div className="relative">
            {dropPosition === 'before' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-10 mx-2 rounded-full" />}
            <div 
                ref={ref}
                draggable={!isEditing}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={(e) => { e.preventDefault(); setDropPosition(null); }}
                onDrop={handleDrop}
                className={`group flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer text-sm transition-all border border-transparent 
                    ${isEditing ? 'bg-zinc-800 ring-1 ring-blue-500/50' : 'hover:bg-zinc-800 text-zinc-300'}
                    ${dropPosition === 'inside' ? 'bg-blue-500/10 text-blue-400' : ''}
                `}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={() => !isEditing && onNavigate(item.pageNumber)}
            >
                <GripVertical className={`w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing mr-1 transition-opacity ${isEditing ? 'hidden' : ''}`} />
                <button onClick={(e) => { e.stopPropagation(); onToggleExpand(item.id); }} className={`p-0.5 rounded hover:bg-zinc-700/50 ${hasChildren ? 'text-zinc-400 hover:text-zinc-200' : 'text-transparent cursor-default'}`}>
                    {item.isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                {isEditing ? (
                    <div className="flex items-center flex-1 gap-1 min-w-0" onClick={e => e.stopPropagation()}>
                        <input autoFocus className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-white outline-none focus:border-blue-500/50" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setIsEditing(false); }} onBlur={handleRenameSubmit} />
                        <button onClick={handleRenameSubmit} className="text-green-400 hover:text-green-300 p-1"><Edit2 className="w-3 h-3" /></button>
                    </div>
                ) : (
                    <>
                        <span className="truncate flex-1 select-none font-medium text-[13px]" title={item.title}>{item.title}</span>
                        <span className="text-[10px] text-zinc-500 font-mono bg-zinc-900/50 px-1.5 rounded ml-2">{item.pageNumber}</span>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5 ml-1">
                             <button onClick={(e) => { e.stopPropagation(); onAddChild(item.id); }} className="p-1 text-zinc-500 hover:text-blue-400 hover:bg-zinc-700 rounded"><Plus className="w-3 h-3" /></button>
                             <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 rounded"><Edit2 className="w-3 h-3" /></button>
                             <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-700 rounded"><Trash2 className="w-3 h-3" /></button>
                        </div>
                    </>
                )}
            </div>
            {dropPosition === 'after' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-10 mx-2 rounded-full" />}
            {item.isExpanded && hasChildren && <div>{item.children.map((child) => <OutlineItem key={child.id} item={child} level={level + 1} onNavigate={onNavigate} onToggleExpand={onToggleExpand} onRename={onRename} onDelete={onDelete} onAddChild={onAddChild} onMove={onMove} />)}</div>}
        </div>
    );
};
