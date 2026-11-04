/** Browser-side image cache. The registry holds only URLs; images live here. */
class AssetStore {
  private images = new Map<string, HTMLImageElement>();
  private pending = new Map<string, Promise<void>>();

  get(url: string): HTMLImageElement | undefined {
    const img = this.images.get(url);
    return img && img.complete && img.naturalWidth > 0 ? img : undefined;
  }

  load(urls: readonly string[]): Promise<void> {
    return Promise.all(urls.map((u) => this.loadOne(u))).then(() => undefined);
  }

  private loadOne(url: string): Promise<void> {
    const existing = this.pending.get(url);
    if (existing) return existing;
    const p = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => {
        console.warn(`[assets] failed to load ${url}`);
        resolve(); // a missing sheet should not block the match; the renderer skips it
      };
      img.src = url;
      this.images.set(url, img);
    });
    this.pending.set(url, p);
    return p;
  }
}

export const assets = new AssetStore();
