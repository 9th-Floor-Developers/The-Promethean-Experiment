/**
 * Top-level UI screens. Same URL, no router: App holds this in state.
 * WorldScene's PRESETS is a
 * Record<Screen, ...>, so TypeScript will force a camera preset for each.
 */
export type Screen = 'landing' | 'opening' | 'credits' | 'settings' | 'simulation';
