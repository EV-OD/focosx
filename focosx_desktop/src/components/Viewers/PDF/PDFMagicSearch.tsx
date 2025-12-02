import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Send, Network, MessageSquare, Loader2, FileText, ChevronRight, BrainCircuit, Share2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import type * as pdfjsLib from 'pdfjs-dist';

interface PDFMagicSearchProps {
    pdfDoc: pdfjsLib.PDFDocumentProxy | null;
    onClose: () => void;
}

interface GraphNode {
    id: string;
    label: string;
    type: string;
}

interface GraphEdge {
    source: string;
    target: string;
    relation: string;
}

interface KnowledgeGraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export const PDFMagicSearch: React.FC<PDFMagicSearchProps> = ({ pdfDoc, onClose }) => {
    const [mode, setMode] = useState<'rag' | 'graph'>('rag');
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<Array<{role: 'user' | 'model', text: string}>>([]);
    const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
    const [docText, setDocText] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. Extract Text on Mount
    useEffect(() => {
        const extractText = async () => {
            if (!pdfDoc) return;
            try {
                // Limit to first 20 pages to avoid hitting token limits/performance issues in this demo
                const maxPages = Math.min(pdfDoc.numPages, 20);
                let fullText = "";
                for (let i = 1; i <= maxPages; i++) {
                    const page = await pdfDoc.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');
                    fullText += `Page ${i}:\n${pageText}\n\n`;
                }
                setDocText(fullText);
            } catch (e) {
                console.error("Failed to extract text", e);
            }
        };
        extractText();
    }, [pdfDoc]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleRagSubmit = async () => {
        if (!query.trim() || !docText) return;
        const userQuery = query;
        setQuery('');
        setMessages(prev => [...prev, { role: 'user', text: userQuery }]);
        setIsLoading(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `You are an intelligent PDF assistant. Use the provided document context to answer the user's question accurately.
            
            Document Context:
            ${docText.substring(0, 30000)}... (truncated if too long)
            
            User Question: ${userQuery}
            
            Answer nicely formatted in Markdown.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            setMessages(prev => [...prev, { role: 'model', text: response.text || "I couldn't generate a response." }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'model', text: "Error: Failed to connect to AI service." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const generateGraph = async () => {
        if (!docText) return;
        setIsLoading(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Analyze the following document text and extract a Knowledge Graph.
            Identify key entities (nodes) and their relationships (edges).
            
            Return ONLY a valid JSON object with this structure:
            {
              "nodes": [{"id": "1", "label": "Entity Name", "type": "Person/Location/Concept"}],
              "edges": [{"source": "1", "target": "2", "relation": "verb/connection"}]
            }
            Limit to 15 key nodes and their relationships.
            
            Document Text:
            ${docText.substring(0, 20000)}`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json'
                }
            });

            const json = JSON.parse(response.text || '{}');
            if (json.nodes && json.edges) {
                setGraphData(json);
            }
        } catch (error) {
            console.error("Graph Gen Error", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-generate graph when switching to graph tab for first time
    useEffect(() => {
        if (mode === 'graph' && !graphData && !isLoading && docText) {
            generateGraph();
        }
    }, [mode, docText]);

    return (
        <div className="absolute inset-y-0 right-0 w-[400px] bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-700/50 shadow-2xl flex flex-col z-30 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20">
                <div className="flex items-center gap-2 text-zinc-100 font-bold">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        Magic Search
                    </span>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex p-2 gap-2 border-b border-zinc-800">
                <button
                    onClick={() => setMode('rag')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${mode === 'rag' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <MessageSquare className="w-4 h-4" />
                    Q&A Chat
                </button>
                <button
                    onClick={() => setMode('graph')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${mode === 'graph' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <Network className="w-4 h-4" />
                    Knowledge Graph
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                {mode === 'rag' ? (
                    <>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4 opacity-50">
                                    <BrainCircuit className="w-16 h-16" />
                                    <p className="text-sm text-center max-w-[200px]">
                                        Ask anything about this document. I'll analyze the content for you.
                                    </p>
                                </div>
                            )}
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`
                                        max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                                        ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-zinc-800 text-zinc-200 rounded-bl-none'}
                                    `}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-zinc-800 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                                        <span className="text-xs text-zinc-400">Thinking...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
                            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1 focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/20 transition-all">
                                <input
                                    className="flex-1 bg-transparent border-none outline-none text-sm text-white px-2 py-2 placeholder-zinc-600"
                                    placeholder="Ask a question..."
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleRagSubmit()}
                                />
                                <button 
                                    onClick={handleRagSubmit}
                                    disabled={!query.trim() || isLoading}
                                    className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 relative">
                         {isLoading && !graphData ? (
                             <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2">
                                 <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                                 <span className="text-xs">Extracting Knowledge Graph...</span>
                             </div>
                         ) : !graphData ? (
                             <div className="text-center text-zinc-500 mt-20">
                                 <Network className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                 <p>Failed to load graph.</p>
                                 <button onClick={generateGraph} className="mt-4 text-xs text-blue-400 hover:underline">Retry</button>
                             </div>
                         ) : (
                             <div className="space-y-6">
                                 <div className="flex items-center justify-between">
                                     <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Entities ({graphData.nodes.length})</h3>
                                     <button onClick={generateGraph} className="p-1 hover:bg-zinc-800 rounded text-zinc-500"><Share2 className="w-3 h-3" /></button>
                                 </div>
                                 
                                 <div className="grid grid-cols-1 gap-3">
                                     {graphData.nodes.map(node => (
                                         <div key={node.id} className="bg-zinc-800/50 border border-zinc-800 rounded-lg p-3 flex items-start gap-3 hover:border-zinc-700 transition-colors">
                                             <div className="w-8 h-8 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center shrink-0 border border-blue-900/50">
                                                 {node.label.charAt(0).toUpperCase()}
                                             </div>
                                             <div>
                                                 <div className="font-medium text-zinc-200 text-sm">{node.label}</div>
                                                 <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mt-0.5">{node.type}</div>
                                             </div>
                                         </div>
                                     ))}
                                 </div>

                                 <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider pt-4 border-t border-zinc-800">Relationships</h3>
                                 <div className="space-y-2">
                                     {graphData.edges.map((edge, i) => {
                                         const source = graphData.nodes.find(n => n.id === edge.source)?.label || 'Unknown';
                                         const target = graphData.nodes.find(n => n.id === edge.target)?.label || 'Unknown';
                                         return (
                                             <div key={i} className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900/30 p-2 rounded border border-zinc-800/50">
                                                 <span className="font-medium text-zinc-300">{source}</span>
                                                 <div className="flex-1 h-px bg-zinc-700 relative">
                                                     <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#121214] px-1 text-[9px] text-zinc-500 whitespace-nowrap">
                                                         {edge.relation}
                                                     </span>
                                                 </div>
                                                 <span className="font-medium text-zinc-300">{target}</span>
                                             </div>
                                         );
                                     })}
                                 </div>
                             </div>
                         )}
                    </div>
                )}
            </div>
        </div>
    );
};