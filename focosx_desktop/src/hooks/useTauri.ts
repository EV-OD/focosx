import { useEffect, useState } from 'react';

export async function waitForTauri(timeout = 3000, interval = 150): Promise<boolean> {
  const max = Math.ceil(timeout / interval);
  for (let i = 0; i < max; i++) {
    if (typeof (window as any).__TAURI__ !== 'undefined') return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

export function useTauri(timeout = 3000) {
  const [state, setState] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const available = await waitForTauri(timeout);
      if (!mounted) return;
      setState(available);
    })();
    return () => {
      mounted = false;
    };
  }, [timeout]);
  return state;
}
