
import React, { useState, useEffect } from 'react';
import { storage } from '../services/StorageService';
import { MessageSquare, Settings, ExternalLink, Bot, PanelRightClose, Globe } from 'lucide-react';

interface AIConfig {
  name: string;
  url: string;
}

export const AIDock: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [customUrl, setCustomUrl] = useState('');

  // Initial Load
  useEffect(() => {
    const loadConfig = async () => {
      const saved = await storage.getAIDockConfig();
      if (saved) {
        setConfig(saved);
      } else {
        setIsConfiguring(true);
      }
    };
    loadConfig();
  }, []);

  const handleSelectService = async (name: string, url: string) => {
    const newConfig = { name, url };
    setConfig(newConfig);
    await storage.saveAIDockConfig(newConfig);
    setIsConfiguring(false);
    setIsOpen(true);
  };

  const handleCustomSubmit = async () => {
    if (!customUrl) return;
    await handleSelectService('Custom AI', customUrl);
  };

  const handleReset = async () => {
    setIsConfiguring(true);
    setIsOpen(true);
  };

  if (!isOpen) {
    return (
      <div className="absolute right-4 bottom-4 pointer-events-auto z-50">
        <button 
          onClick={() => setIsOpen(true)}
          className="p-3 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-blue-400 hover:bg-zinc-700 shadow-xl transition-all hover:scale-110 flex items-center justify-center"
          title="Open AI Dock"
        >
          <Bot className="w-6 h-6" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-0 h-full w-[400px] border-l border-zinc-800 bg-[#09090b] flex flex-col shadow-2xl transition-transform duration-300 pointer-events-auto animate-in slide-in-from-right">
      
      {/* Header */}
      <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50">
        <div className="flex items-center gap-2 text-zinc-200 font-medium">
          <Bot className="w-4 h-4 text-blue-400" />
          <span>{config?.name || 'AI Assistant'}</span>
        </div>
        <div className="flex items-center gap-1">
          {config && !isConfiguring && (
             <>
                <a 
                    href={config.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                    title="Open in new tab (Use if blocked)"
                >
                    <ExternalLink className="w-4 h-4" />
                </a>
                <button 
                    onClick={handleReset}
                    className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                    title="Change Service"
                >
                    <Settings className="w-4 h-4" />
                </button>
             </>
          )}
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
            title="Close Dock"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {isConfiguring || !config ? (
          <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center">
            <Bot className="w-12 h-12 text-zinc-700 mb-4" />
            <h3 className="text-lg font-bold text-zinc-200 mb-2">Choose your AI</h3>
            <p className="text-xs text-zinc-500 mb-6 max-w-[250px]">
              Select an AI service to dock in your workspace. 
              <br/>
              <span className="opacity-50 italic">Note: Some services may block embedding.</span>
            </p>

            <div className="w-full max-w-xs space-y-3">
              <button 
                onClick={() => handleSelectService('ChatGPT', 'https://chatgpt.com')}
                className="w-full p-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg flex items-center gap-3 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center border border-green-500/30">
                    <MessageSquare className="w-4 h-4" />
                </div>
                <div className="flex flex-col items-start">
                    <span className="text-sm font-bold text-zinc-200">ChatGPT</span>
                    <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400">OpenAI</span>
                </div>
              </button>

              <button 
                onClick={() => handleSelectService('Gemini', 'https://gemini.google.com/app')}
                className="w-full p-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg flex items-center gap-3 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center border border-blue-500/30">
                    <Bot className="w-4 h-4" />
                </div>
                <div className="flex flex-col items-start">
                    <span className="text-sm font-bold text-zinc-200">Gemini</span>
                    <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400">Google</span>
                </div>
              </button>

              <div className="relative pt-4">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-zinc-800"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-2 bg-[#09090b] text-[10px] text-zinc-500 uppercase">Or Custom</span>
                  </div>
              </div>

              <div className="flex gap-2">
                  <input 
                    placeholder="https://..."
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500/50"
                    value={customUrl}
                    onChange={e => setCustomUrl(e.target.value)}
                  />
                  <button 
                    onClick={handleCustomSubmit}
                    disabled={!customUrl}
                    className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      <Globe className="w-4 h-4" />
                  </button>
              </div>
            </div>
          </div>
        ) : (
          <iframe 
            src={config.url} 
            className="w-full h-full border-none bg-white"
            allow="clipboard-write; microphone" // Microphone needed for voice features
            title="AI Dock Frame"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" // Relaxed sandbox for compatibility
          />
        )}
      </div>
    </div>
  );
};
