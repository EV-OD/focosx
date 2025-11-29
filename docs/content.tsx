
import { DocCategory } from './types';

export const DOCS_DATA: DocCategory[] = [
    {
        id: 'getting-started',
        title: 'Getting Started',
        pages: [
            {
                id: 'introduction',
                title: 'Introduction',
                category: 'Getting Started',
                sections: [
                    {
                        type: 'markdown',
                        content: `FocosX is a modular spatial workspace designed for extensibility. Unlike traditional applications where plugins are separate entities, FocosX treats almost every interactive element—from Sticky Notes to PDF Viewers—as a plugin.

**Core Principles:**
- **Runtime Hydration:** Plugins are injected into the application at runtime. This means you can add features without recompiling the core app.
- **Shared Runtime:** Dependencies like \`React\` and \`Lucide\` are exposed globally. Your plugin code is lightweight because it doesn't bundle these libraries.
- **Spatial First:** The primary interface is an infinite canvas. Plugins define "Frames" (the widgets on the canvas) and "Tools" (how you interact with them).

This documentation guides you through the ecosystem, starting with basic concepts and moving to a complex, production-grade PDF viewer plugin.`
                    },
                    {
                        type: 'note',
                        title: 'Prerequisites',
                        content: 'You do not need a complex build chain. Plugins are essentially JavaScript strings that export a configuration object. Basic knowledge of React hooks (`useState`, `useEffect`) is recommended.'
                    }
                ]
            },
            {
                id: 'architecture',
                title: 'Architecture & Lifecycle',
                category: 'Getting Started',
                sections: [
                    {
                        type: 'markdown',
                        content: `### How Plugins Load
FocosX uses a dynamic hydration system. When the app starts (or a vault is opened), the \`PluginManager\` performs the following:

1.  **Fetch:** Loads the raw JavaScript string (from LocalStorage or a remote URL).
2.  **Factory Execution:** Wraps the code in a \`new Function(...)\` block. This sandboxes the scope slightly and allows us to inject dependencies.
3.  **Hydration:** Executes the function, passing in \`React\`, \`Lucide\`, and \`API_TYPES\`.
4.  **Registration:** The function returns a \`PluginDefinition\` object, which is stored in the manager's registry.

### The Definition Object
Every plugin must return an object matching the \`PluginDefinition\` interface. This object tells FocosX what capabilities the plugin adds (Widgets, Files, Tools).`
                    },
                    {
                        type: 'code',
                        language: 'typescript',
                        content: `interface PluginDefinition {
  id: string;          // Unique identifier (e.g., 'core-weather')
  name: string;        // Human readable name
  version: string;     // SemVer string
  
  // Capabilities
  frameTypes?: { ... };     // Widgets that live on the canvas
  fileRenderers?: { ... };  // Full-screen file editors
  globalTools?: [...];      // Buttons in the creative toolbar
}`
                    }
                ]
            }
        ]
    },
    {
        id: 'tutorials',
        title: 'Widget Tutorials',
        pages: [
            {
                id: 'tutorial-counter',
                title: 'Basic: Counter Widget',
                category: 'Widget Tutorials',
                sections: [
                    {
                        type: 'markdown',
                        content: `This tutorial demonstrates the smallest possible valid plugin: a counter that saves its number to the database.

### 1. State Management
A Frame Component receives a \`frame\` prop. The \`frame.content\` property is a persistent string field stored in the \`.canvas\` file.
Because it's a string, we must:
1.  **Parse** it when the component mounts.
2.  **Stringify** it when we save.`
                    },
                    {
                        type: 'code',
                        language: 'javascript',
                        content: `const CounterFrame = ({ frame, onUpdate }) => {
  // 1. Initialize: Parse the content string into an object
  const [state, setState] = React.useState(() => {
     try {
       // If content is empty/null, start at 0
       return frame.content ? JSON.parse(frame.content) : { count: 0 };
     } catch {
       return { count: 0 };
     }
  });

  // 2. Action: Update local state AND persist to disk
  const increment = () => {
     const newState = { count: state.count + 1 };
     setState(newState); // Updates UI immediately
     
     // onUpdate sends data to the host app
     // The host app handles debouncing and writing to the file system
     onUpdate({ content: JSON.stringify(newState) });
  };

  return React.createElement('div', { className: "p-4 bg-zinc-800 text-white" }, [
      React.createElement('h1', null, \`Count: \${state.count}\`),
      React.createElement('button', { onClick: increment }, "Increment")
  ]);
};`
                    },
                    {
                        type: 'markdown',
                        content: `### 2. Registration
We register this component under \`frameTypes\`. The key \`'counter'\` is what is used internally by the canvas data structure.`
                    },
                    {
                        type: 'code',
                        language: 'javascript',
                        content: `return {
  id: "tutorial-counter",
  name: "Counter Widget",
  version: "1.0.0",
  frameTypes: {
    'counter': {
      label: 'Counter',
      icon: React.createElement(Lucide.PlusCircle),
      component: CounterFrame,
      defaultDimensions: { width: 200, height: 200 }
    }
  }
};`
                    }
                ]
            },
            {
                id: 'tutorial-youtube',
                title: 'Intermediate: YouTube Player',
                category: 'Widget Tutorials',
                sections: [
                    {
                        type: 'markdown',
                        content: `This tutorial introduces **external libraries** and **handling empty states**.

### The Challenge
We want to embed a YouTube video.
1.  **Data:** We only need to save the Video ID (e.g., \`dQw4w9WgXcQ\`).
2.  **Empty State:** If no ID is saved, show a form to paste a URL.
3.  **View State:** If an ID exists, show the iframe.`
                    },
                    {
                        type: 'markdown',
                        content: `### Implementation
Notice how we check \`frame.content\` at the top level to decide which UI to render.`
                    },
                    {
                        type: 'code',
                        language: 'javascript',
                        content: `const YouTubeFrame = ({ frame, onUpdate }) => {
  const [inputValue, setInputValue] = React.useState('');
  const videoId = frame.content; // We store the ID directly as the content string

  // Helper to extract ID from URL
  const handleSubmit = () => {
    const id = inputValue.split('v=')[1]; 
    if (id) onUpdate({ content: id });
  };

  // Case 1: Empty State (No video selected)
  if (!videoId) {
    return React.createElement('div', { className: "bg-black p-4" }, [
        React.createElement('input', {
            placeholder: "Paste YouTube URL...",
            value: inputValue,
            onChange: (e) => setInputValue(e.target.value)
        }),
        React.createElement('button', { onClick: handleSubmit }, "Load")
    ]);
  }

  // Case 2: Player State
  return React.createElement('div', { className: "w-full h-full relative" }, [
      // The Reset Button
      React.createElement('button', {
          className: "absolute top-2 right-2 z-10 bg-red-600 text-white p-1",
          onClick: () => onUpdate({ content: '' }) // Clearing content triggers Empty State
      }, "Reset"),
      
      // The Iframe
      React.createElement('iframe', {
          width: "100%",
          height: "100%",
          src: \`https://www.youtube.com/embed/\${videoId}\`,
          frameBorder: "0"
      })
  ]);
};`
                    }
                ]
            }
        ]
    },
    {
        id: 'actual-plugin-pdf',
        title: 'Case Study: PDF Viewer',
        pages: [
            {
                id: 'pdf-deep-dive-1',
                title: 'Architecture & Constraints',
                category: 'Case Study: PDF Viewer',
                sections: [
                    {
                        type: 'markdown',
                        content: `The \`PDFPlugin\` (found in \`plugins/core/PDFPlugin.tsx\`) is a production-grade example. It solves complex problems that simple widgets don't face.

### The Constraints
1.  **Performance:** PDFs are heavy. Decoding a page takes 10-50ms. If we do this on every render frame (60fps), the app will freeze.
2.  **Resolution:** A PDF looks blurry if rendered at 100% scale on a 4K monitor. We need to account for \`window.devicePixelRatio\`.
3.  **Coordinate Systems:** We want to draw highlights on the PDF. The canvas has its own coordinate system (World Space), but the PDF has its own (Document Space).

### Plugin Structure
The plugin defines two distinct parts:
1.  **The Viewer (\`PDFFrame\`):** Displays the document and handles scrolling/zooming.
2.  **The Tool (\`pdf-highlighter\`):** A button in the global toolbar that changes the interaction mode to "Draw" specifically for PDF frames.`
                    }
                ]
            },
            {
                id: 'pdf-deep-dive-2',
                title: 'Rendering Strategy (React.memo)',
                category: 'Case Study: PDF Viewer',
                sections: [
                    {
                        type: 'markdown',
                        content: `### The Rendering Pipeline

The \`PDFFrame\` component does **not** render the PDF directly. It delegates that to a child component called \`PageRenderer\`.

**Why separation is critical:**
When you drag a frame on the canvas, the \`PDFFrame\` receives new props (\`frame.x\`, \`frame.y\`) every 16ms. If the PDF rendering logic lived inside \`PDFFrame\`, it would attempt to redraw the canvas on every drag step.

By extracting it to \`PageRenderer\` and wrapping it in \`React.memo\`, we ensure the heavy PDF draw calls only happen when:
1. The page number changes.
2. The width changes (resize).
3. The global zoom scale changes significantly.`
                    },
                    {
                        type: 'code',
                        language: 'javascript',
                        content: `// Simplified PageRenderer
const PageRenderer = React.memo(({ pdfDoc, pageNum, width, globalScale }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        // 1. Get Page
        const page = await pdfDoc.getPage(pageNum);
        
        // 2. Calculate DPI-aware Viewport
        // We want the canvas to look sharp even if zoomed in
        const dpr = window.devicePixelRatio || 1;
        
        // "Logical" width (CSS pixels)
        const displayWidth = width - 32; 
        
        // Calculate scale factor required to fit page into displayWidth
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scaleFactor = displayWidth / unscaledViewport.width;
        
        // Final render scale includes Device Pixel Ratio
        const renderViewport = page.getViewport({ scale: scaleFactor * dpr });

        const ctx = canvasRef.current.getContext('2d');
        
        // 3. Render
        await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;
        
    }, [pdfDoc, pageNum, width, globalScale]);

    return <canvas ref={canvasRef} />;
});`
                    }
                ]
            },
            {
                id: 'pdf-deep-dive-3',
                title: 'Interaction & Coordinate Mapping',
                category: 'Case Study: PDF Viewer',
                sections: [
                    {
                        type: 'markdown',
                        content: `### Custom Drawing Tools
The FocosX canvas handles general drawing (pens/markers) on top of everything. However, for a PDF, we want the annotations to **scroll with the document**. This means we cannot use the global drawing layer. We must capture the events inside the frame.

#### 1. Capturing the Event
We check if our custom tool is active. If so, we call \`e.stopPropagation()\` to prevent the canvas from panning.`
                    },
                    {
                        type: 'code',
                        language: 'javascript',
                        content: `const handlePointerDown = (e) => {
    // Is the user holding the "PDF Highlighter" tool?
    if (customTool && customTool.id === 'pdf-highlighter') {
        e.stopPropagation(); // Stop global canvas pan
        e.target.setPointerCapture(e.pointerId); // Lock mouse to this element
        
        // Start local drawing logic...
    }
};`
                    },
                    {
                        type: 'markdown',
                        content: `#### 2. Coordinate Mapping
This is the most complex part of spatial plugins. We need to convert **Screen Coordinates** (pixels on your monitor) into **Document Coordinates** (relative x/y inside the scrollable PDF div).

\`offset = (ScreenPos - ContainerPos) / Scale\`

In the PDF plugin, we handle this by referencing the scrollable container's bounding rectangle.`
                    },
                    {
                        type: 'code',
                        language: 'javascript',
                        content: `const rect = documentWrapperRef.current.getBoundingClientRect();

// e.clientX is global screen X
// rect.left is where the PDF container is on screen
// internalScale is the zoom level of the PDF itself

const x = (e.clientX - rect.left) / internalScale;
const y = (e.clientY - rect.top) / internalScale;

// Now 'x' and 'y' are relative to the top-left corner of the PDF page,
// regardless of where the frame is on the canvas or how zoomed in we are.`
                    }
                ]
            }
        ]
    },
    {
        id: 'advanced',
        title: 'Advanced Capabilities',
        pages: [
            {
                id: 'advanced-tools',
                title: 'Creating Global Tools',
                category: 'Advanced Capabilities',
                sections: [
                    {
                        type: 'markdown',
                        content: `Global Tools appear in the bottom toolbar. They are not bound to a specific frame but can affect the "Mode" of the application or configure \`customTool\` state.

### Anatomy of a Tool`
                    },
                    {
                        type: 'code',
                        language: 'javascript',
                        content: `{
    id: 'my-stamper',
    label: 'Approval Stamp',
    icon: <RubberStampIcon />,
    
    // Appearance controls how it looks in the dock
    appearance: {
        type: 'brush', 
        color: '#10b981', 
        widthClass: 'w-12', 
        heightClass: 'h-16', 
        tipColor: '#059669'
    },
    
    // onClick fires when the user selects the tool from the dock
    onClick: ({ setMode, setCustomTool }) => {
        // 1. We can switch the canvas to 'draw' mode
        setMode('draw');
        
        // 2. We can pass arbitrary config to frames via 'customTool'
        setCustomTool({
            id: 'my-stamper',
            type: 'action', // or 'brush'
            color: '#10b981'
        });
    }
}`
                    }
                ]
            }
        ]
    },
    {
        id: 'api-reference',
        title: 'API Reference',
        pages: [
            {
                id: 'frame-props',
                title: 'Frame Component Props',
                category: 'API Reference',
                sections: [
                    {
                        type: 'markdown',
                        content: `These props are passed to every component registered in \`frameTypes\`.`
                    },
                    {
                        type: 'table',
                        tableData: {
                            columns: [
                                { header: 'Prop', key: 'prop' },
                                { header: 'Type', key: 'type' },
                                { header: 'Description', key: 'desc' }
                            ],
                            rows: [
                                { prop: 'frame', type: 'FrameData', desc: 'The persisted data object. Contains .content, .x, .y, .width, .height.' },
                                { prop: 'onUpdate', type: 'function', desc: '(updates: Partial<FrameData>) => void. Persists changes to disk.' },
                                { prop: 'isActive', type: 'boolean', desc: 'True if the frame is currently selected.' },
                                { prop: 'isFocused', type: 'boolean', desc: 'True if in "Focus Mode" (maximized).' },
                                { prop: 'scale', type: 'number', desc: 'Current global canvas zoom level (0.1 to 5.0).' },
                                { prop: 'isResizing', type: 'boolean', desc: 'True during a resize operation. Useful for pausing expensive renders.' },
                                { prop: 'customTool', type: 'CustomToolConfig', desc: 'The configuration of the currently active global tool (if any).' }
                            ]
                        }
                    }
                ]
            },
            {
                id: 'interaction-config',
                title: 'Interaction Configuration',
                category: 'API Reference',
                sections: [
                    {
                        type: 'markdown',
                        content: `The \`interaction\` object in your plugin definition controls how the canvas handles events targeting your frame.`
                    },
                    {
                        type: 'table',
                        tableData: {
                            columns: [
                                { header: 'Property', key: 'prop' },
                                { header: 'Type', key: 'type' },
                                { header: 'Description', key: 'desc' }
                            ],
                            rows: [
                                { prop: 'dragHandle', type: "'header' | 'everywhere'", desc: "Defaults to 'everywhere'. If set to 'header', the frame can only be dragged by the top bar. Useful for frames with internal interactive elements (sliders, buttons)." },
                                { prop: 'captureWheel', type: 'boolean', desc: "If true, mouse wheel events are NOT passed to the canvas zoomer. Essential for scrollable content (PDFs, Code Editors)." }
                            ]
                        }
                    }
                ]
            }
        ]
    }
];
