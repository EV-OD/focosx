
import React from 'react';
import { PanelLeft, PanelLeftClose, RotateCcw, RotateCw, BookOpen, Columns, Search, ZoomOut, ZoomIn, Minus, Plus } from 'lucide-react';

interface PDFToolbarProps {
    fileName: string;
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
    rotatePage: (direction: 'cw' | 'ccw') => void;
    layoutMode: 'single' | 'spread';
    onToggleLayoutMode: () => void;
    internalScale: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onToggleSearch: () => void;
    isSearchOpen: boolean;
    enableSidebar: boolean;
}

interface ToolbarButtonProps {
    active?: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    disabled?: boolean;
    className?: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ active, onClick, title, children, disabled, className }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`
            p-1.5 rounded-md transition-all duration-200 flex items-center justify-center
            ${disabled ? 'opacity-50 cursor-not-allowed text-zinc-600' : ''}
            ${!disabled && active 
                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' 
                : !disabled && 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }
            ${className || ''}
        `}
    >
        {children}
    </button>
);

const Divider = () => <div className="w-px h-4 bg-zinc-800 mx-1" />;

export const PDFToolbar: React.FC<PDFToolbarProps> = ({
    fileName, isSidebarOpen, onToggleSidebar, rotatePage, layoutMode, onToggleLayoutMode, internalScale, onZoomIn, onZoomOut, onToggleSearch, isSearchOpen, enableSidebar
}) => {
    return (
        <div className={`
            flex items-center justify-between px-3 shrink-0 select-none border-b border-zinc-800 bg-zinc-900/95 backdrop-blur z-20 transition-all
            ${enableSidebar ? 'h-12' : 'h-10'}
        `}>
            {/* Left Group: Sidebar & File Info */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <ToolbarButton 
                    onClick={onToggleSidebar} 
                    active={isSidebarOpen} 
                    title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
                >
                    {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
                </ToolbarButton>
                
                <span className="font-medium text-zinc-300 truncate text-xs select-none max-w-[200px]" title={fileName}>
                    {fileName}
                </span>
            </div>

            {/* Center Group: View Controls */}
            <div className="flex items-center gap-1 bg-zinc-950/50 p-1 rounded-lg border border-zinc-800/50 shadow-sm">
                <ToolbarButton onClick={() => rotatePage('ccw')} title="Rotate Counter-Clockwise">
                    <RotateCcw className="w-3.5 h-3.5" />
                </ToolbarButton>
                <ToolbarButton onClick={() => rotatePage('cw')} title="Rotate Clockwise">
                    <RotateCw className="w-3.5 h-3.5" />
                </ToolbarButton>
                
                <Divider />
                
                <ToolbarButton 
                    onClick={onToggleLayoutMode} 
                    active={layoutMode === 'spread'} 
                    title={layoutMode === 'single' ? "Switch to Spread View" : "Switch to Single Page"}
                >
                    {layoutMode === 'single' ? <BookOpen className="w-3.5 h-3.5" /> : <Columns className="w-3.5 h-3.5" />}
                </ToolbarButton>
            </div>

            {/* Right Group: Zoom & Search */}
            <div className="flex items-center gap-1 flex-1 justify-end">
                <ToolbarButton 
                    onClick={onToggleSearch} 
                    active={isSearchOpen} 
                    title="Find in Document (Ctrl+F)"
                >
                    <Search className="w-4 h-4" />
                </ToolbarButton>
                
                <Divider />
                
                <div className="flex items-center bg-zinc-950/50 rounded-md border border-zinc-800/50 mx-1">
                    <button 
                        onClick={onZoomOut} 
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-l-md transition-colors"
                        title="Zoom Out"
                    >
                        <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-mono text-zinc-300 w-10 text-center select-none">
                        {Math.round(internalScale * 100)}%
                    </span>
                    <button 
                        onClick={onZoomIn} 
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-r-md transition-colors"
                        title="Zoom In"
                    >
                        <Plus className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
    );
};
