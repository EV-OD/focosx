
import React, { useState, useEffect, useCallback } from 'react';
import { PluginDefinition, FileRendererProps, PluginFrameProps } from '../api/types';
import { Table, Plus, Trash2, FileSpreadsheet, Save, Download, Grid3X3, Columns, Rows } from 'lucide-react';

// --- Helper Functions ---

const parseCSV = (content: string): string[][] => {
    if (!content || !content.trim()) return [['', '', ''], ['', '', '']]; // Default template
    return content.split('\n').map(row => row.split(','));
};

const stringifyCSV = (data: string[][]): string => {
    return data.map(row => row.join(',')).join('\n');
};

// --- Full Screen Editor Component ---

const CSVRenderer: React.FC<FileRendererProps> = ({ file, content, onSave }) => {
    // Initialize state from content
    const [data, setData] = useState<string[][]>(() => parseCSV(typeof content === 'string' ? content : ''));
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Sync external content changes (e.g. file reloaded)
    useEffect(() => {
        if (typeof content === 'string' && content !== stringifyCSV(data) && !hasUnsavedChanges) {
            setData(parseCSV(content));
        }
    }, [content]);

    const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
        const newData = [...data];
        newData[rowIndex] = [...newData[rowIndex]];
        newData[rowIndex][colIndex] = value;
        setData(newData);
        setHasUnsavedChanges(true);
    };

    const addRow = () => {
        const colCount = data[0]?.length || 3;
        const newRow = Array(colCount).fill('');
        setData([...data, newRow]);
        setHasUnsavedChanges(true);
    };

    const addColumn = () => {
        const newData = data.map(row => [...row, '']);
        setData(newData);
        setHasUnsavedChanges(true);
    };

    const removeRow = (index: number) => {
        if (data.length <= 1) return;
        const newData = data.filter((_, i) => i !== index);
        setData(newData);
        setHasUnsavedChanges(true);
    };

    const handleSave = () => {
        const csvString = stringifyCSV(data);
        onSave(csvString);
        setHasUnsavedChanges(false);
    };

    const handleExport = () => {
        const csvString = stringifyCSV(data);
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.click();
    };

    return (
        <div className="flex flex-col h-full bg-[#09090b] text-zinc-300">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-green-500" />
                    <span className="font-medium text-sm">{file.name}</span>
                    {hasUnsavedChanges && <span className="text-[10px] text-yellow-500 ml-2">● Unsaved</span>}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={addColumn} className="p-1.5 hover:bg-zinc-800 rounded text-xs flex items-center gap-1 text-zinc-400 hover:text-white">
                        <Plus className="w-3 h-3" /> Col
                    </button>
                    <button onClick={addRow} className="p-1.5 hover:bg-zinc-800 rounded text-xs flex items-center gap-1 text-zinc-400 hover:text-white">
                        <Plus className="w-3 h-3" /> Row
                    </button>
                    <div className="w-px h-4 bg-zinc-800 mx-1" />
                    <button onClick={handleExport} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="Export CSV">
                        <Download className="w-4 h-4" />
                    </button>
                    <button onClick={handleSave} className={`p-1.5 rounded flex items-center gap-1 text-xs font-medium transition-colors ${hasUnsavedChanges ? 'bg-blue-600 text-white hover:bg-blue-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        <Save className="w-3 h-3" />
                        Save
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-auto p-4">
                <div className="inline-block min-w-full border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-800 text-zinc-400 text-xs uppercase font-medium">
                            <tr>
                                <th className="w-8 px-2 py-2 text-center border-r border-zinc-700">#</th>
                                {data[0]?.map((_, i) => (
                                    <th key={i} className="px-3 py-2 border-r border-zinc-700 min-w-[100px] font-mono text-zinc-500">
                                        {String.fromCharCode(65 + i)}
                                    </th>
                                ))}
                                <th className="w-8"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {data.map((row, rIndex) => (
                                <tr key={rIndex} className="group hover:bg-zinc-800/50">
                                    <td className="text-center text-zinc-600 text-xs border-r border-zinc-800 select-none bg-zinc-900/50">
                                        {rIndex + 1}
                                    </td>
                                    {row.map((cell, cIndex) => (
                                        <td key={cIndex} className="p-0 border-r border-zinc-800/50 relative">
                                            <input 
                                                className="w-full h-full px-3 py-2 bg-transparent outline-none focus:bg-blue-500/10 focus:shadow-[inset_0_0_0_1px_rgba(59,130,246,0.5)] transition-all text-zinc-200"
                                                value={cell}
                                                onChange={(e) => handleCellChange(rIndex, cIndex, e.target.value)}
                                            />
                                        </td>
                                    ))}
                                    <td className="p-0 text-center">
                                        <button 
                                            onClick={() => removeRow(rIndex)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-600 hover:text-red-400 transition-opacity"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- Canvas Widget Component ---

const CSVFrame: React.FC<PluginFrameProps> = ({ frame, onUpdate, isResizing, isActive }) => {
    // We treat frame.content as the CSV string
    const [data, setData] = useState<string[][]>(() => parseCSV(typeof frame.content === 'string' ? frame.content : ''));

    // Re-sync if content changes externally (e.g. undo/redo)
    useEffect(() => {
        const currentString = stringifyCSV(data);
        if (typeof frame.content === 'string' && frame.content !== currentString) {
            setData(parseCSV(frame.content));
        }
    }, [frame.content]);

    // Autosave wrapper
    const updateData = (newData: string[][]) => {
        setData(newData);
        onUpdate({ content: stringifyCSV(newData) });
    };

    const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
        const newData = [...data];
        newData[rowIndex] = [...newData[rowIndex]];
        newData[rowIndex][colIndex] = value;
        updateData(newData);
    };

    const addRow = () => {
        const colCount = data[0]?.length || 3;
        const newRow = Array(colCount).fill('');
        updateData([...data, newRow]);
    };

    const addColumn = () => {
        const newData = data.map(row => [...row, '']);
        updateData(newData);
    };
    
    const removeRow = (index: number) => {
        if (data.length <= 1) return;
        const newData = data.filter((_, i) => i !== index);
        updateData(newData);
    };

    return (
        <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800/50 text-zinc-300 overflow-hidden">
             {/* Mini Toolbar (Only visible when active to reduce clutter) */}
             <div className={`flex items-center gap-1 p-1 border-b border-zinc-800 bg-zinc-900/80 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}>
                <button onClick={addColumn} className="p-1 hover:bg-zinc-700 rounded text-[10px] flex items-center gap-1 text-zinc-400 hover:text-white" title="Add Column">
                    <Columns className="w-3 h-3" />
                </button>
                <button onClick={addRow} className="p-1 hover:bg-zinc-700 rounded text-[10px] flex items-center gap-1 text-zinc-400 hover:text-white" title="Add Row">
                    <Rows className="w-3 h-3" />
                </button>
             </div>

             {/* Compact Table */}
             <div 
                className="flex-1 overflow-auto bg-[#09090b] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
                onWheel={(e) => e.stopPropagation()} // Allow scrolling table without zooming canvas
             >
                <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-zinc-900 text-zinc-500 font-medium sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="w-6 px-1 py-1 text-center border-r border-b border-zinc-800 bg-zinc-900">#</th>
                            {data[0]?.map((_, i) => (
                                <th key={i} className="px-2 py-1 border-r border-b border-zinc-800 min-w-[60px] font-mono bg-zinc-900">
                                    {String.fromCharCode(65 + i)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, rIndex) => (
                            <tr key={rIndex} className="group hover:bg-zinc-900/50">
                                <td className="text-center text-zinc-600 border-r border-b border-zinc-800 select-none bg-zinc-900/30 relative">
                                    {rIndex + 1}
                                    {/* Row Delete (Hover) */}
                                    <button 
                                        onClick={() => removeRow(rIndex)}
                                        className="absolute inset-0 flex items-center justify-center bg-red-900/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </td>
                                {row.map((cell, cIndex) => (
                                    <td key={cIndex} className="p-0 border-r border-b border-zinc-800 relative">
                                        <input 
                                            className="w-full h-full px-2 py-1 bg-transparent outline-none focus:bg-blue-500/10 focus:shadow-[inset_0_0_0_1px_rgba(59,130,246,0.5)] transition-all text-zinc-300 placeholder-zinc-700"
                                            value={cell}
                                            onChange={(e) => handleCellChange(rIndex, cIndex, e.target.value)}
                                            onPointerDown={(e) => e.stopPropagation()} // Allow text selection without dragging frame
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
        </div>
    );
};

export const CSVPlugin: PluginDefinition = {
    id: 'csv-editor',
    name: 'CSV Editor',
    version: '1.0.0',
    description: 'A simple spreadsheet-like editor for CSV files.',
    frameTypes: {
        'csv-frame': {
            label: 'Table',
            icon: <Grid3X3 className="w-4 h-4" />,
            component: CSVFrame,
            defaultDimensions: { width: 400, height: 300 },
            handledExtensions: ['csv'], // Enables drag & drop of .csv files to canvas
            interaction: {
                dragHandle: 'header', // Must use header to drag since table handles clicks
                captureWheel: true    // Internal scrolling
            }
        }
    },
    fileRenderers: {
        'csv-editor': {
            id: 'csv-editor-main',
            label: 'CSV Table',
            icon: <Table className="w-4 h-4" />,
            handledExtensions: ['csv', 'tsv'],
            component: CSVRenderer
        }
    }
};
