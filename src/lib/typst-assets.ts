export type TypstAsset = {
  fileName: string;
  source: string;
};

const assets = new Map<string, string>();

export function clearTypstAssets() {
  assets.clear();
}

export function registerTypstAsset(fileName: string, source: string) {
  assets.set(fileName, source);
}

export function takeTypstAssets(): TypstAsset[] {
  const result = Array.from(assets, ([fileName, source]) => ({
    fileName,
    source,
  }));
  assets.clear();
  return result;
}
