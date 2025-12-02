import React, { useEffect, useRef, useState } from 'react';
import { PluginDefinition, FileRendererProps, PluginFrameProps } from '../api/types';
import { FileText, Zap } from 'lucide-react';
import * as NutrientViewer from '@nutrient-sdk/viewer';

// Helper to check if we are in a supported environment or if the SDK loaded
const isNutrientLoaded = () => {
    return typeof (window as any).NutrientViewer !== 'undefined' || typeof NutrientViewer !== 'undefined';
};

// --- Canvas Frame Component ---

const PDFFrameV2: React.FC<PluginFrameProps> = ({ frame, onUpdate, isResizing, isActive }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!frame.content || frame.content === 'MOCK_PDF_BINARY_DATA' || !containerRef.current) return;
        
        let mounted = true;

        const loadViewer = async () => {
            try {
                // Ensure unique ID for container
                const containerId = `nutrient-frame-${frame.id}`;
                containerRef.current!.id = containerId;

                // Attempt to load. 
                // NOTE: Nutrient SDK requires assets to be served. 
                // Since we are in a sandbox without 'cp' capabilities for assets, 
                // this might fail if the CDN doesn't handle everything.
                // We wrap in try/catch to fallback gracefully.
                
                // We use the global namespace if loaded via script, or import if via ESM
                const ViewerClass = (window as any).NutrientViewer || NutrientViewer;

                if (!ViewerClass) {
                    throw new Error("Nutrient SDK not loaded");
                }

                // Convert base64 to blob/url if needed, or pass directly if supported
                let documentSource = frame.content;
                if (typeof frame.content === 'string' && !frame.content.startsWith('http')) {
                     // Assume base64 or raw data, create blob url
                     // For this demo, we assume the content IS the data/url
                }

                const instance = await ViewerClass.load({
                    container: `#${containerId}`,
                    document: documentSource,
                    // Minimal UI for canvas frame
                    toolbarItems: [], 
                    baseUrl: 'https://cdn.jsdelivr.net/npm/@nutrient-sdk/viewer@1.9.1/dist/', // Attempt to point to CDN assets
                });

                if (mounted) {
                    instanceRef.current = instance;
                } else {
                    instance.unload();
                }
            } catch (err: any) {
                console.error("Nutrient Load Error:", err);
                if (mounted) setError(err.message || "Failed to load Nutrient Viewer");
            }
        };

        loadViewer();

        return () => {
            mounted = false;
            if (instanceRef.current) {
                instanceRef.current.unload();
                instanceRef.current = null;
            }
        };
    }, [frame.content, frame.id]);

    if (error) {
        return (
            <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center p-4 text-center">
                <Zap className="w-8 h-8 text-yellow-500 mb-2" />
                <p className="text-zinc-400 text-sm">Nutrient SDK Unavailable</p>
                <p className="text-xs text-zinc-600 mt-1">Falling back to basic view recommended.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-white relative">
            {/* Header for Dragging */}
            <div className="absolute top-0 left-0 right-0 h-6 bg-transparent z-10 pointer-events-none" />
            <div ref={containerRef} className="w-full h-full" />
             {/* Overlay to intercept clicks for dragging if not interactive */}
             {!isActive && <div className="absolute inset-0 z-20 bg-transparent" />}
        </div>
    );
};

// --- File Viewer Component ---

const PDFRendererV2: React.FC<FileRendererProps> = ({ file, content, onSave }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        let mounted = true;

        const load = async () => {
            try {
                const ViewerClass = (window as any).NutrientViewer || NutrientViewer;
                if (!ViewerClass) throw new Error("Nutrient SDK not available");
                
                // Basic check for mock data
                if (content === 'MOCK_PDF_BINARY_DATA') {
                    throw new Error("Cannot render mock data in V2 viewer.");
                }

                const instance = await ViewerClass.load({
                    container: container,
                    document: content, // Pass the content directly (URL or ArrayBuffer)
                    baseUrl: 'https://cdn.jsdelivr.net/npm/@nutrient-sdk/viewer@1.9.1/dist/', // CDN Fallback for assets
                });

                if (mounted) {
                    instanceRef.current = instance;
                    
                    // Hook into save if needed
                    // instance.addEventListener("document.save", ...)
                } else {
                    instance.unload();
                }

            } catch (err: any) {
                 console.error("Nutrient Viewer V2 Error:", err);
                 if (mounted) setError(err.message || "Failed to initialize V2 Viewer");
            }
        };
        
        load();

        return () => {
            mounted = false;
            if (instanceRef.current) {
                // Nutrient SDK cleanup
                instanceRef.current.unload();
            }
        };
    }, [content]);

    if (error) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-zinc-400">
                <FileText className="w-12 h-12 mb-4 text-red-400" />
                <h3 className="text-lg font-medium text-white">V2 Viewer Error</h3>
                <p className="max-w-md text-center mt-2 text-sm text-zinc-500">{error}</p>
                <p className="text-xs text-zinc-600 mt-4">Note: The Nutrient SDK requires specific assets to be hosted. In this demo environment, CORS or asset loading might fail.</p>
            </div>
        );
    }

    return <div ref={containerRef} className="w-full h-full bg-[#f0f0f0]" />;
};

export const PDFPluginV2: PluginDefinition = {
    id: 'core-pdf-viewer-v2',
    name: 'Nutrient PDF Viewer (V2)',
    version: '2.0.0',
    description: 'High-performance PDF viewer powered by Nutrient SDK (formerly PSPDFKit).',
    frameTypes: {
        'pdf-viewer-v2': {
            label: 'PDF (Nutrient)',
            icon: <Zap className="w-4 h-4 text-yellow-500" />,
            component: PDFFrameV2,
            defaultDimensions: { width: 600, height: 800 },
            handledExtensions: ['pdf'],
            interaction: { dragHandle: 'header' }
        }
    },
    fileRenderers: {
        'pdf-viewer-v2-main': {
            id: 'pdf-viewer-v2-main',
            label: 'Nutrient PDF Viewer',
            icon: <Zap className="w-4 h-4 text-yellow-500" />,
            handledExtensions: ['pdf'],
            component: PDFRendererV2
        }
    }
};