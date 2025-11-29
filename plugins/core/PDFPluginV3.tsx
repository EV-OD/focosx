import React, { useEffect, useRef, useState } from "react";
import {
  PluginDefinition,
  FileRendererProps,
  PluginFrameProps,
} from "../api/types";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
} from "lucide-react";

// NOTE:
// We intentionally avoid static imports for @embedpdf modules so Vite/Rollup
// won't attempt to bundle them. Instead we dynamically load them from known
// CDN fallbacks at runtime. This keeps the build from failing when these
// packages are not available from the registry or should be loaded separately.

// Runtime module holders (filled by `loadEmbedPdfModules`)
let init: any = null;
let PdfiumEngine: any = null;

// Try a dynamic import for a given URL. We use @vite-ignore so Vite doesn't
// try to resolve these at build time.
async function tryDynamicImport(url: string) {
  try {
    // @vite-ignore
    return await import(/* @vite-ignore */ url);
  } catch (e) {
    return null;
  }
}

// Attempt multiple CDN fallbacks and pick the first that works.
async function loadEmbedPdfModules() {
  if (init && PdfiumEngine) return { init, PdfiumEngine };

  const pdfiumCandidates = [
    "https://esm.sh/@embedpdf/pdfium",
    "https://cdn.jsdelivr.net/npm/@embedpdf/pdfium",
    "https://unpkg.com/@embedpdf/pdfium",
  ];

  const engineCandidates = [
    "https://esm.sh/@embedpdf/engines/pdfium",
    "https://cdn.jsdelivr.net/npm/@embedpdf/engines/pdfium",
    "https://unpkg.com/@embedpdf/engines/pdfium",
  ];

  for (const url of pdfiumCandidates) {
    const mod = await tryDynamicImport(url);
    if (mod) {
      // prefer named export `init`, otherwise fall back to default
      if (mod.init) {
        init = mod.init;
        break;
      } else if (mod.default) {
        init = mod.default.init ?? mod.default;
        if (init) break;
      }
    }
  }

  for (const url of engineCandidates) {
    const mod = await tryDynamicImport(url);
    if (mod) {
      // prefer named PdfiumEngine, otherwise check default export
      if (mod.PdfiumEngine) {
        PdfiumEngine = mod.PdfiumEngine;
        break;
      } else if (mod.default) {
        PdfiumEngine = mod.default.PdfiumEngine ?? mod.default;
        if (PdfiumEngine) break;
      }
    }
  }

  if (!init) {
    throw new Error(
      "Failed to load @embedpdf/pdfium from CDN. Check network or CDN availability.",
    );
  }
  if (!PdfiumEngine) {
    throw new Error(
      "Failed to load @embedpdf/engines/pdfium from CDN. Check network or CDN availability.",
    );
  }

  return { init, PdfiumEngine };
}

// --- Helpers ---

const CDN_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@embedpdf/pdfium/dist/pdfium.wasm";

// Helper to convert base64 to Uint8Array for the engine
function base64ToUint8Array(base64: string): Uint8Array {
  try {
    const cleanBase64 = base64.includes("base64,")
      ? base64.split("base64,")[1]
      : base64;
    const binary_string = window.atob(cleanBase64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("Failed to convert base64", e);
    return new Uint8Array(0);
  }
}

// --- Shared Engine Logic ---

let wasmInitialized = false;
let pdfiumInstance: any = null;

const initializeWasm = async () => {
  if (wasmInitialized && pdfiumInstance) return pdfiumInstance;

  try {
    // Ensure embedpdf modules are loaded from CDN at runtime
    const modules = await loadEmbedPdfModules();
    // modules.init and modules.PdfiumEngine now available (and also stored in `init`/`PdfiumEngine`)

    const response = await fetch(CDN_WASM_URL);
    if (!response.ok)
      throw new Error(`Failed to load WASM: ${response.statusText}`);
    const wasmBinary = await response.arrayBuffer();

    // call the runtime-provided init function
    pdfiumInstance = await modules.init({ wasmBinary });

    // Initialize the PDFium extension library if present
    if (pdfiumInstance && pdfiumInstance.PDFiumExt_Init) {
      pdfiumInstance.PDFiumExt_Init();
    }

    wasmInitialized = true;
    return pdfiumInstance;
  } catch (err) {
    console.error("WASM Initialization failed", err);
    throw err;
  }
};

// --- PDF Viewer Component (Reusable) ---

const PDFiumViewer: React.FC<{
  content: string;
  fileName: string;
  scale?: number;
  interactive?: boolean;
  className?: string;
}> = ({
  content,
  fileName,
  scale: propScale = 1,
  interactive = true,
  className,
}) => {
  const [engine, setEngine] = useState<PdfiumEngine | null>(null);
  const [doc, setDoc] = useState<any>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1); // Internal zoom
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial Engine Setup
  useEffect(() => {
    let active = true;

    const setup = async () => {
      try {
        if (!content) {
          setLoading(false);
          return;
        }

        setLoading(true);
        const pdfium = await initializeWasm();
        const newEngine = new PdfiumEngine(pdfium);
        await newEngine.initialize().toPromise();

        if (!active) return;
        setEngine(newEngine);

        // Open Document
        let document;
        if (content.startsWith("http")) {
          document = await newEngine
            .openDocumentUrl({ id: fileName, url: content })
            .toPromise();
        } else if (content === "MOCK_PDF_BINARY_DATA") {
          throw new Error(
            "Mock data not supported in V3. Please upload a real PDF.",
          );
        } else {
          const buffer = base64ToUint8Array(content);
          if (buffer.length === 0) throw new Error("Invalid PDF Data");
          document = await newEngine
            .openDocumentBuffer({ id: fileName, content: buffer })
            .toPromise();
        }

        if (!active) return;
        setDoc(document);
        setNumPages(document.pages.length);
        setPageIndex(0);
        setLoading(false);
      } catch (err: any) {
        console.error("PDFium V3 Error", err);
        if (active) {
          setError(err.message || "Failed to load PDF");
          setLoading(false);
        }
      }
    };

    setup();

    return () => {
      active = false;
    };
  }, [content, fileName]);

  // Render Page
  useEffect(() => {
    if (!engine || !doc) return;

    let active = true;

    const render = async () => {
      try {
        // Render with high quality by ensuring we have enough pixels
        // For now we use default settings as the engine handles scaling efficiently
        const imageBlob = await engine
          .renderPage(doc, doc.pages[pageIndex])
          .toPromise();

        if (!active) return;

        const url = URL.createObjectURL(imageBlob);
        setImageSrc(url);

        return () => URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Render Page Error", e);
      }
    };

    render();
    return () => {
      active = false;
    };
  }, [engine, doc, pageIndex]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-full w-full text-zinc-500 gap-2 bg-zinc-900">
        <Loader2 className="animate-spin w-5 h-5" /> Initializing Engine...
      </div>
    );
  if (error)
    return (
      <div className="flex items-center justify-center h-full w-full text-red-400 p-4 text-center bg-zinc-900">
        {error}
      </div>
    );

  const effectiveZoom = zoom * propScale;

  return (
    <div className={`flex flex-col h-full bg-zinc-900 ${className}`}>
      {/* Toolbar */}
      {interactive && (
        <div className="h-10 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-2 shrink-0 z-10">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-zinc-400 px-2 max-w-[150px] truncate">
              {fileName}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-zinc-900/50 rounded p-0.5 border border-zinc-800">
            <button
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex <= 0}
              className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30 text-zinc-400"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-zinc-300 w-16 text-center">
              {pageIndex + 1} / {numPages}
            </span>
            <button
              onClick={() => setPageIndex((p) => Math.min(numPages - 1, p + 1))}
              disabled={pageIndex >= numPages - 1}
              className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30 text-zinc-400"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-zinc-500 w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Viewport */}
      <div className="flex-1 overflow-auto bg-[#333] flex items-start justify-center p-8 relative">
        {imageSrc && (
          <div
            className="shadow-2xl transition-transform duration-100 origin-top bg-white"
            style={{ transform: `scale(${effectiveZoom})` }}
          >
            <img
              src={imageSrc}
              alt={`Page ${pageIndex + 1}`}
              className="block max-w-none"
            />
          </div>
        )}
      </div>
    </div>
  );
};

// --- Plugin Wrappers ---

const PDFFrameV3: React.FC<PluginFrameProps> = ({ frame }) => {
  return (
    <div className="w-full h-full relative">
      {/* Header overlay for dragging */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-transparent z-20" />
      <PDFiumViewer
        content={typeof frame.content === "string" ? frame.content : ""}
        fileName={frame.name}
        interactive={true}
        className="w-full h-full"
      />
    </div>
  );
};

const PDFRendererV3: React.FC<FileRendererProps> = ({ file, content }) => {
  return (
    <PDFiumViewer
      content={typeof content === "string" ? content : ""}
      fileName={file.name}
      interactive={true}
      className="w-full h-full"
    />
  );
};

export const PDFPluginV3: PluginDefinition = {
  id: "core-pdf-viewer-v3",
  name: "PDFium Viewer (V3)",
  version: "3.0.0",
  description: "High-performance PDF viewer using PDFium WebAssembly engine.",
  frameTypes: {
    "pdf-viewer-v3": {
      label: "PDF (PDFium)",
      icon: <FileText className="w-4 h-4 text-red-400" />,
      component: PDFFrameV3,
      defaultDimensions: { width: 600, height: 800 },
      handledExtensions: ["pdf"],
      interaction: { dragHandle: "header" },
    },
  },
  fileRenderers: {
    "pdf-viewer-v3-main": {
      id: "pdf-viewer-v3-main",
      label: "PDFium Engine Viewer",
      icon: <FileText className="w-4 h-4 text-red-500" />,
      handledExtensions: ["pdf"],
      component: PDFRendererV3,
    },
  },
};
