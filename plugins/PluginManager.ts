

import React, { ReactNode } from 'react';
import * as LucideIcons from 'lucide-react';
import { PluginDefinition, FrameTypeDefinition, GlobalTool, FileRendererDefinition } from './api/types';
import * as API_TYPES from './api/types';
import { storage } from '../services/StorageService';
import { RemotePluginService, RemotePluginManifest } from '../services/RemotePluginService';

// Import Core Plugins
import { StickyNotePlugin } from './core/StickyNotePlugin';
import { PDFPlugin } from './core/PDFPlugin';
import { PDFPluginV2 } from './core/PDFPluginV2'; // Import V2
import { PDFPluginV3 } from './core/PDFPluginV3'; // Import V3
import { ImagePlugin } from './core/ImagePlugin';
import { PPTXPlugin } from './core/PPTXPlugin';
// Optional Plugins Catalog
import { YouTubePlugin } from './core/YouTubePlugin';
import { CSVPlugin } from './core/CSVPlugin';

// Catalog of ALL available optional plugins (Bundled)
export const OPTIONAL_PLUGINS_CATALOG = [
    YouTubePlugin,
    CSVPlugin
];

export type PluginScope = 'global' | 'workspace' | 'core';

export interface InstalledPluginInfo {
    plugin: PluginDefinition;
    scope: PluginScope;
}

class PluginManagerImpl {
  private activePlugins: Map<string, PluginDefinition> = new Map();
  // Store definitions of fetched plugins (available but not necessarily active in scope)
  private loadedRemotePlugins: Map<string, PluginDefinition> = new Map();
  
  private listeners: Set<() => void> = new Set();
  
  // Track IDs for scopes
  private globalPluginIds: Set<string> = new Set();
  private workspacePluginIds: Set<string> = new Set();
  
  private currentVaultId: string | null = null;
  private preferences: Record<string, string> = {};

  constructor() {
    this.registerCore(StickyNotePlugin);
    this.registerCore(PDFPlugin);
    this.registerCore(PDFPluginV2); // Register V2
    this.registerCore(PDFPluginV3); // Register V3
    this.registerCore(ImagePlugin);
    this.registerCore(PPTXPlugin);
  }

  /**
   * Called when the App switches vaults or loads up.
   * Loads global plugins + workspace plugins for this vault.
   */
  async initialize(vaultId: string | null) {
      this.currentVaultId = vaultId;
      
      // 1. Reset Active (Keep Core)
      this.activePlugins.clear();
      this.registerCore(StickyNotePlugin);
      this.registerCore(PDFPlugin);
      this.registerCore(PDFPluginV2); // Register V2
      this.registerCore(PDFPluginV3); // Register V3
      this.registerCore(ImagePlugin);
      this.registerCore(PPTXPlugin);

      // 2. Load and Hydrate Remote Plugins from Storage
      const storedRemotePlugins = await storage.getInstalledRemotePlugins();
      for (const p of storedRemotePlugins) {
          try {
              const def = this.hydratePlugin(p.code);
              if (def) {
                  this.loadedRemotePlugins.set(def.id, def);
              }
          } catch (e) {
              console.error(`Failed to hydrate stored remote plugin ${p.id}`, e);
          }
      }

      // 3. Load Global Ids
      const globalIds = await storage.getGlobalPluginIds();
      this.globalPluginIds = new Set(globalIds);
      this.enablePluginsFromIds(globalIds);

      // 4. Load Workspace Ids (if vault selected)
      this.workspacePluginIds = new Set();
      if (vaultId) {
          const workspaceIds = await storage.getWorkspacePluginIds(vaultId);
          this.workspacePluginIds = new Set(workspaceIds);
          this.enablePluginsFromIds(workspaceIds);
      }
      
      // 5. Load Preferences
      await this.loadPreferences();

      this.notify();
  }
  
  async loadPreferences() {
      // Load standard preferences from storage (e.g., 'default_pdf_renderer')
      const pdfPref = await storage.getPreference('default_pdf_renderer');
      if (pdfPref) this.preferences['pdf'] = pdfPref;
  }

  async setPreferredRenderer(extension: string, rendererId: string) {
      this.preferences[extension] = rendererId;
      await storage.savePreference(`default_${extension}_renderer`, rendererId);
      this.notify();
  }

  private registerCore(plugin: PluginDefinition) {
      this.activePlugins.set(plugin.id, plugin);
  }

  private enablePluginsFromIds(ids: string[]) {
      ids.forEach(id => {
          // Check Bundled Catalog first
          const bundled = OPTIONAL_PLUGINS_CATALOG.find(p => p.id === id);
          if (bundled) {
              this.activePlugins.set(bundled.id, bundled);
              return;
          }

          // Check Loaded Remote Plugins
          const remote = this.loadedRemotePlugins.get(id);
          if (remote) {
              this.activePlugins.set(remote.id, remote);
          }
      });
  }

  /**
   * Execute raw JS string in a sandboxed function with dependencies injected.
   */
  private hydratePlugin(code: string): PluginDefinition | null {
      try {
          // Create a factory function. 
          // We pass React, Lucide, and our Types definitions to the plugin.
          const factory = new Function('React', 'Lucide', 'API_TYPES', code);
          const definition = factory(React, LucideIcons, API_TYPES);
          
          if (!definition || !definition.id) {
              throw new Error("Plugin code did not return a valid PluginDefinition object.");
          }
          return definition as PluginDefinition;
      } catch (err) {
          console.error("Plugin Hydration Error:", err);
          return null;
      }
  }

  /**
   * Fetch code from remote, hydrate it, install it, and enable it in the target scope.
   */
  async installRemotePlugin(manifest: RemotePluginManifest, scope: 'global' | 'workspace') {
      try {
          // 1. Fetch Code
          const code = await RemotePluginService.fetchPluginCode(manifest.scriptUrl);
          
          // 2. Hydrate
          const pluginDef = this.hydratePlugin(code);
          if (!pluginDef) throw new Error("Failed to parse plugin code.");

          // 3. Save to Storage (Code Persistence)
          await storage.saveInstalledRemotePlugin({
              id: pluginDef.id,
              code: code,
              manifestUrl: manifest.scriptUrl
          });
          
          // 4. Cache in Memory
          this.loadedRemotePlugins.set(pluginDef.id, pluginDef);

          // 5. Activate in Scope
          await this.installPlugin(pluginDef.id, scope, true); // true = isRemote
          
      } catch (err) {
          console.error("Install Remote Plugin Failed:", err);
          alert("Failed to install plugin. See console for details.");
      }
  }

  /**
   * Enable an existing plugin (bundled or already downloaded remote) in a specific scope.
   */
  async installPlugin(pluginId: string, scope: 'global' | 'workspace', isRemote: boolean = false) {
      // Find definition
      let pluginDef = OPTIONAL_PLUGINS_CATALOG.find(p => p.id === pluginId);
      if (!pluginDef) {
          pluginDef = this.loadedRemotePlugins.get(pluginId);
      }

      if (!pluginDef) {
          console.error("Plugin definition not found for:", pluginId);
          return;
      }

      if (scope === 'global') {
          this.globalPluginIds.add(pluginId);
          await storage.saveGlobalPluginIds(Array.from(this.globalPluginIds));
      } else {
          if (!this.currentVaultId) {
              console.error("No active vault to install workspace plugin");
              return;
          }
          this.workspacePluginIds.add(pluginId);
          await storage.saveWorkspacePluginIds(this.currentVaultId, Array.from(this.workspacePluginIds));
      }

      // Activate immediately
      this.activePlugins.set(pluginDef.id, pluginDef);
      this.notify();
  }

  /**
   * Uninstall a plugin from a specific scope.
   */
  async uninstallPlugin(pluginId: string, scope: 'global' | 'workspace') {
      if (scope === 'global') {
          this.globalPluginIds.delete(pluginId);
          await storage.saveGlobalPluginIds(Array.from(this.globalPluginIds));
      } else {
          if (!this.currentVaultId) return;
          this.workspacePluginIds.delete(pluginId);
          await storage.saveWorkspacePluginIds(this.currentVaultId, Array.from(this.workspacePluginIds));
      }

      // Check if completely unused
      const isCore = pluginId.startsWith('core-');
      const isGlobal = this.globalPluginIds.has(pluginId);
      const isWorkspace = this.workspacePluginIds.has(pluginId);

      if (!isCore && !isGlobal && !isWorkspace) {
          this.activePlugins.delete(pluginId);
      }
      
      this.notify();
  }

  isInstalled(pluginId: string): { global: boolean; workspace: boolean } {
      return {
          global: this.globalPluginIds.has(pluginId),
          workspace: this.workspacePluginIds.has(pluginId)
      };
  }

  getAllActivePlugins(): PluginDefinition[] {
    return Array.from(this.activePlugins.values());
  }

  // --- Helpers for Components ---

  getFrameType(typeId: string): FrameTypeDefinition | null {
    for (const plugin of this.activePlugins.values()) {
      if (plugin.frameTypes && plugin.frameTypes[typeId]) {
        return plugin.frameTypes[typeId];
      }
    }
    return null;
  }

  getAllFrameTypes(): Array<{ id: string; label: string; icon: ReactNode; pluginName: string }> {
    const types: Array<{ id: string; label: string; icon: ReactNode; pluginName: string }> = [];
    this.activePlugins.forEach(p => {
      if (p.frameTypes) {
          Object.entries(p.frameTypes).forEach(([id, def]) => {
            types.push({ id, label: def.label, icon: def.icon, pluginName: p.name });
          });
      }
    });
    return types;
  }

  getFrameTypeForExtension(extension: string): string | null {
      // NOTE: For Canvas Frames, we usually want the first one that supports the filetype 
      // OR we can add preference support here too if needed for drag-drop behavior.
      const ext = extension.toLowerCase().replace(/^\./, '');
      for (const plugin of this.activePlugins.values()) {
          if (plugin.frameTypes) {
              for (const [typeId, def] of Object.entries(plugin.frameTypes)) {
                  if (def.handledExtensions && def.handledExtensions.includes(ext)) {
                      return typeId;
                  }
              }
          }
      }
      return null;
  }

  getAllGlobalTools(): GlobalTool[] {
      let tools: GlobalTool[] = [];
      this.activePlugins.forEach(p => {
          if (p.globalTools) {
              tools = [...tools, ...p.globalTools];
          }
      });
      return tools;
  }
  
  // Get all available renderers for a specific extension
  getAllFileRenderersForExtension(extension: string): FileRendererDefinition[] {
    const ext = extension.toLowerCase().replace(/^\./, '');
    const renderers: FileRendererDefinition[] = [];
    
    for (const plugin of this.activePlugins.values()) {
        if (plugin.fileRenderers) {
            for (const renderer of Object.values(plugin.fileRenderers)) {
                if (renderer.handledExtensions.includes(ext)) {
                    renderers.push(renderer);
                }
            }
        }
    }
    return renderers;
  }

  getPreferredFileRenderer(extension: string): FileRendererDefinition | null {
    const renderers = this.getAllFileRenderersForExtension(extension);
    if (renderers.length === 0) return null;
    
    const ext = extension.toLowerCase().replace(/^\./, '');
    const prefId = this.preferences[ext];
    
    if (prefId) {
        const preferred = renderers.find(r => r.id === prefId);
        if (preferred) return preferred;
    }
    
    // Default to first found if no preference or preference not found
    return renderers[0];
  }
  
  // Backwards compatibility wrapper if needed, or deprecate
  getFileRendererForExtension(extension: string): FileRendererDefinition | null {
      return this.getPreferredFileRenderer(extension);
  }

  subscribe(callback: () => void) {
      this.listeners.add(callback);
      return () => { this.listeners.delete(callback); };
  }

  private notify() {
      this.listeners.forEach(cb => cb());
  }
}

export const PluginManager = new PluginManagerImpl();