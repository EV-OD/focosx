
import React, { useRef, useEffect } from 'react';
import { Search, Loader2, X, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';
import { SearchState } from './types';

interface PDFSearchProps {
    search: SearchState;
    onUpdateQuery: (query: string) => void;
    onClose: () => void;
    onNext: () => void;
    onPrev: () => void;
    onClear: () => void;
}

export const PDFSearch: React.FC<PDFSearchProps> = ({ search, onUpdateQuery, onClose, onNext, onPrev, onClear }) => {
    const searchInputRef = useRef<HTMLInputElement>(null);
    const hasResults = search.results.length > 0;
    const noResults = search.query.length >= 2 && !search.isSearching && !hasResults;

    // Auto focus when opened
    useEffect(() => {
        if(searchInputRef.current) searchInputRef.current.select();
    }, []);

    return (
        <div className="absolute top-16 right-8 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="bg-[#18181b] border border-zinc-700 shadow-2xl rounded-xl p-1.5 flex items-center gap-2 min-w-[320px]">
                
                {/* Search Input Area */}
                <div className={`
                    flex-1 flex items-center gap-2 rounded-lg px-2 h-9 border transition-all
                    ${noResults ? 'bg-red-900/10 border-red-900/30' : 'bg-zinc-900 border-zinc-800 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20'}
                `}>
                    {search.isSearching ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
                    ) : (
                        <Search className={`w-4 h-4 shrink-0 ${noResults ? 'text-red-400' : 'text-zinc-500'}`} />
                    )}
                    
                    <form onSubmit={(e) => { e.preventDefault(); onNext(); }} className="flex-1 min-w-0 flex items-center h-full">
                        <input 
                            ref={searchInputRef} 
                            className={`w-full h-full bg-transparent outline-none text-sm placeholder-zinc-600 ${noResults ? 'text-red-200' : 'text-zinc-200'}`} 
                            placeholder="Find in document..." 
                            value={search.query} 
                            onChange={e => onUpdateQuery(e.target.value)} 
                            autoFocus 
                        />
                    </form>
                    
                    {search.query && (
                        <button onClick={onClear} className="shrink-0 p-0.5 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1 pl-1 border-l border-zinc-800">
                    <div className="text-[10px] font-mono text-zinc-500 min-w-[40px] text-center select-none flex items-center justify-center">
                        {hasResults ? (
                            <span className="text-zinc-300 font-medium">
                                {search.currentResultIndex + 1} <span className="text-zinc-600">/</span> {search.results.length}
                            </span>
                        ) : noResults ? (
                             <span className="text-red-400 font-medium">0</span>
                        ) : (
                             <span className="opacity-30">-</span>
                        )}
                    </div>

                    <div className="flex items-center bg-zinc-900 rounded-md border border-zinc-800">
                        <button 
                            onClick={onPrev} 
                            disabled={!hasResults} 
                            className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 hover:bg-zinc-800 rounded-l-md transition-colors"
                            title="Previous Match (Shift+Enter)"
                        >
                            <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-px h-4 bg-zinc-800" />
                        <button 
                            onClick={onNext} 
                            disabled={!hasResults} 
                            className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 hover:bg-zinc-800 rounded-r-md transition-colors"
                            title="Next Match (Enter)"
                        >
                            <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <button 
                        onClick={onClose} 
                        className="p-1.5 text-zinc-500 hover:text-white hover:bg-red-900/50 rounded-md ml-1 transition-colors"
                        title="Close Search"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
