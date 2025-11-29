

import { PluginDefinition } from '../plugins/api/types';

export interface RemotePluginManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  scriptUrl: string; // URL to the raw JS file
  iconName?: string; // Icon name to map to Lucide
  tags: string[];
}

class RemotePluginServiceImpl {
  private API_BASE_URL = 'https://api.your-focos-repo.com'; // Replace with real API
  private USE_MOCK_SERVER = true; // Set to false to use real internet fetching

  // --- MOCK DATA (Simulating "Public Folder" Hosting) ---
  
  // The raw code for the Clock Plugin. 
  // In a real app, this would be a file at /public/plugins/clock.js
  private MOCK_CLOCK_CODE = `
    const { useState, useEffect } = React;
    const { Clock, Watch } = Lucide;

    // --- Clock Component ---
    const ClockFrame = ({ frame, isResizing }) => {
        const [time, setTime] = useState(new Date());

        useEffect(() => {
            const timer = setInterval(() => setTime(new Date()), 1000);
            return () => clearInterval(timer);
        }, []);

        const seconds = time.getSeconds();
        const minutes = time.getMinutes();
        const hours = time.getHours();

        const secDeg = (seconds / 60) * 360;
        const minDeg = (minutes / 60) * 360 + (seconds / 60) * 6;
        const hourDeg = (hours / 12) * 360 + (minutes / 60) * 30;

        return React.createElement('div', { 
            className: "w-full h-full bg-zinc-900 flex flex-col items-center justify-center relative overflow-hidden border border-zinc-700 rounded-full shadow-2xl" 
        }, [
            // Face
            React.createElement('div', { className: "relative w-[90%] h-[90%] rounded-full border-4 border-zinc-600 bg-zinc-800 shadow-inner" }, [
                // Hour Hand
                React.createElement('div', { 
                    className: "absolute top-1/2 left-1/2 w-1.5 h-[25%] bg-zinc-200 origin-bottom rounded-full -translate-x-1/2 -translate-y-full",
                    style: { transform: \`translate(-50%, -100%) rotate(\${hourDeg}deg)\` }
                }),
                // Minute Hand
                React.createElement('div', { 
                    className: "absolute top-1/2 left-1/2 w-1 h-[35%] bg-blue-400 origin-bottom rounded-full -translate-x-1/2 -translate-y-full",
                    style: { transform: \`translate(-50%, -100%) rotate(\${minDeg}deg)\` }
                }),
                // Second Hand
                React.createElement('div', { 
                    className: "absolute top-1/2 left-1/2 w-0.5 h-[40%] bg-red-500 origin-bottom rounded-full -translate-x-1/2 -translate-y-full",
                    style: { transform: \`translate(-50%, -100%) rotate(\${secDeg}deg)\` }
                }),
                // Center Dot
                React.createElement('div', { className: "absolute top-1/2 left-1/2 w-3 h-3 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-md" }),
                
                // Numbers (12, 3, 6, 9)
                React.createElement('div', { className: "absolute top-2 left-1/2 -translate-x-1/2 text-zinc-500 font-bold" }, "12"),
                React.createElement('div', { className: "absolute bottom-2 left-1/2 -translate-x-1/2 text-zinc-500 font-bold" }, "6"),
                React.createElement('div', { className: "absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 font-bold" }, "9"),
                React.createElement('div', { className: "absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 font-bold" }, "3")
            ])
        ]);
    };

    // --- Plugin Definition ---
    return {
        id: "remote-clock",
        name: "Analog Clock",
        version: "1.0.0",
        description: "A real-time analog clock fetched from the remote plugin repository.",
        author: "Community",
        frameTypes: {
            'analog-clock': {
                label: 'Clock',
                icon: React.createElement(Clock, { className: "w-4 h-4" }),
                component: ClockFrame,
                defaultDimensions: { width: 300, height: 300 }
            }
        }
    };
  `;

  private MOCK_LISTING: RemotePluginManifest[] = [
    {
      id: "remote-clock",
      name: "Analog Clock",
      description: "A stylish analog clock to keep track of time while you work.",
      version: "1.0.0",
      author: "Focos Team",
      scriptUrl: "/plugins/clock.js", // This path is simulated
      iconName: "Clock",
      tags: ["widget", "utility", "time"]
    }
  ];

  /**
   * Fetch the list of available plugins from the remote server.
   */
  async getPluginListing(): Promise<RemotePluginManifest[]> {
    if (this.USE_MOCK_SERVER) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      return this.MOCK_LISTING;
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/plugins/index.json`);
      if (!response.ok) throw new Error('Failed to fetch listing');
      return await response.json();
    } catch (error) {
      console.error("RemotePluginService Error:", error);
      return [];
    }
  }

  /**
   * Fetch the raw JavaScript code for a specific plugin.
   */
  async fetchPluginCode(url: string): Promise<string> {
    if (this.USE_MOCK_SERVER) {
      await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate download
      if (url.includes('clock.js')) {
          return this.MOCK_CLOCK_CODE;
      }
      throw new Error(`Mock file not found: ${url}`);
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch plugin code from ${url}`);
    return await response.text();
  }
}

export const RemotePluginService = new RemotePluginServiceImpl();