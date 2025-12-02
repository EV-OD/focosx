/**
 * StorageService
 *
 * Re-exports the modular storage implementation.
 * This file exists for backwards compatibility with imports from './services/StorageService'.
 */

// Re-export everything from the modular storage implementation
export { storage, ensureDefaultStructure } from "./storage";
export type { default as IStorageAdapter } from "./storage/IStorageAdapter";
