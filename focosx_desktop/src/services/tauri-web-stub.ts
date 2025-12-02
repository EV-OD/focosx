/**
 * Small Tauri web stub for direct import fallback.
 *
 * This module is used only when running in a web/browser environment where the
 * real '@tauri-apps/api/tauri' package is not available. It provides a minimal
 * shape (an `invoke` function and a default export) so dynamic imports succeed,
 * but clearly errors if native commands are attempted.
 *
 * The real Tauri module will be available when running inside the Tauri runtime.
 */

/**
 * Thrown when a Tauri native command is invoked from a web environment.
 * The message includes the attempted command name to help debugging.
 */
class TauriWebError extends Error {
  constructor(cmd?: string) {
    super(
      `[Tauri stub] '@tauri-apps/api/tauri' is not available in the browser. ` +
        `Attempted to invoke: ${cmd ?? "<unknown>"}. ` +
        `Run inside the Tauri runtime (e.g. 'pnpm tauri dev') to use native commands.`
    );
    this.name = "TauriWebError";
  }
}

/**
 * Minimal `invoke` function signature matching the real Tauri API.
 * Always rejects with a helpful error when used in the browser.
 */
export async function invoke<T = unknown>(cmd?: string, payload?: unknown): Promise<T> {
  // Keep the rejection asynchronous to match the runtime behavior of real `invoke`.
  return Promise.reject(new TauriWebError(cmd));
}

/**
 * Compatibility flag consumers can check to detect runtime environment.
 * Real Tauri runtime does not export this flag (or may behave differently).
 */
export const __TAURI__ = false;

/**
 * Default export shape similar to the real module.
 */
const defaultExport = {
  invoke,
};

export default defaultExport;
