import { loadAvatarPack, preloadSheet } from "virtualtour/avatar";

export async function warmUp(packUrl: string, sheetUrl: string): Promise<void> {
  const controller = new AbortController();
  await preloadSheet(sheetUrl, { signal: controller.signal, timeoutMs: 4000 });
  await loadAvatarPack(packUrl, { signal: controller.signal });
}
