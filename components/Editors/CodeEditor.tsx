import React from 'react';
import Editor, { loader } from '@monaco-editor/react';

// Configure Monaco to load from CDN
const MONACO_VERSION = '0.45.0';
const MONACO_BASE_URL = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min`;

loader.config({ paths: { vs: `${MONACO_BASE_URL}/vs` } });

// Configure worker loader to handle Cross-Origin access correctly
// Browsers restrict Web Workers from loading scripts from other origins.
// We provide a Data URI workaround that bootstraps the worker from the CDN.
if (typeof window !== 'undefined') {
  (window as any).MonacoEnvironment = {
    getWorkerUrl: function (_moduleId: any, label: string) {
      if (label === 'json') {
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
          self.MonacoEnvironment = { baseUrl: '${MONACO_BASE_URL}/' };
          importScripts('${MONACO_BASE_URL}/vs/language/json/json.worker.js');
        `)}`;
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
          self.MonacoEnvironment = { baseUrl: '${MONACO_BASE_URL}/' };
          importScripts('${MONACO_BASE_URL}/vs/language/css/css.worker.js');
        `)}`;
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
          self.MonacoEnvironment = { baseUrl: '${MONACO_BASE_URL}/' };
          importScripts('${MONACO_BASE_URL}/vs/language/html/html.worker.js');
        `)}`;
      }
      if (label === 'typescript' || label === 'javascript') {
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
          self.MonacoEnvironment = { baseUrl: '${MONACO_BASE_URL}/' };
          importScripts('${MONACO_BASE_URL}/vs/language/typescript/ts.worker.js');
        `)}`;
      }
      return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
        self.MonacoEnvironment = { baseUrl: '${MONACO_BASE_URL}/' };
        importScripts('${MONACO_BASE_URL}/vs/base/worker/workerMain.js');
      `)}`;
    },
  };
}

interface CodeEditorProps {
  content: string;
  onChange: (value: string) => void;
  fileName: string;
  readOnly?: boolean;
}

const getLanguageFromExtension = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js': return 'javascript';
    case 'jsx': return 'javascript';
    case 'ts': case 'tsx': return 'typescript';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'json': return 'json';
    case 'md': return 'markdown';
    case 'py': return 'python';
    case 'java': return 'java';
    case 'c': case 'h': return 'c';
    case 'cpp': case 'hpp': return 'cpp';
    case 'xml': return 'xml';
    case 'yaml': case 'yml': return 'yaml';
    case 'sql': return 'sql';
    case 'txt': return 'plaintext';
    default: return 'markdown'; // Default to markdown for unknown text files
  }
};

export const CodeEditor: React.FC<CodeEditorProps> = ({ content, onChange, fileName, readOnly = false }) => {
  return (
    <div className="w-full h-full overflow-hidden bg-[#1e1e1e]">
      <Editor
        height="100%"
        language={getLanguageFromExtension(fileName)}
        value={content}
        theme="vs-dark"
        onChange={(value) => onChange(value || '')}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          padding: { top: 16 },
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          contextmenu: true,
        }}
        loading={
            <div className="h-full w-full flex items-center justify-center text-zinc-500 bg-[#1e1e1e]">
                <span className="text-sm">Initializing Editor...</span>
            </div>
        }
      />
    </div>
  );
};