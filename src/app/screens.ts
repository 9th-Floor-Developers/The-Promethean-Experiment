/**
 * Top-level UI screens. Same URL, no router: App holds this in state.
 * Future: add 'settings' (integration point: Opening's disabled Settings button). WorldScene's PRESETS is a
 * Record<Screen, ...>, so TypeScript will force a camera preset for each.
 */
export type Screen = 'landing' | 'opening' | 'credits' | 'simulation';
