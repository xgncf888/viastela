// Static 2x Retina 3D Isometric Floating Rock Island Assets (Flow Study / Vitality Gym / Wish Vault)
// Served as static PNG files from public/islands/ so 900 KB of base64 image data never blocks JS bundle parsing.

function resolveIslandAssetPath(fileName: string): string {
  if (
    typeof window !== 'undefined' &&
    window.location?.pathname &&
    window.location.pathname.includes('/assets/www/')
  ) {
    return `./islands/${fileName}`;
  }
  return `/islands/${fileName}`;
}

export const ISLAND_3D_DATA_URI: Record<'focus' | 'vitality' | 'wishes', string> = {
  get focus() {
    return resolveIslandAssetPath('focus.png');
  },
  get vitality() {
    return resolveIslandAssetPath('vitality.png');
  },
  get wishes() {
    return resolveIslandAssetPath('wishes.png');
  },
};
