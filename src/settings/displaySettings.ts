/**
 * Display preferences: how the simulation looks to the viewer, independent of the simulation itself.
 * Unlike presets these are global (the same for every preset) and never change what the animals do.
 */

/** Viewer-side display options. */
export interface DisplaySettings {
    /**
     * Keep the scene lit as midday: no darkening at night and no sunrise/sunset colour shifts.
     * For viewers sensitive to flashing or changing light (e.g. photosensitive epilepsy) or who want less eye strain.
     * The simulated day-night cycle still runs (nocturnal animals still sleep by day); only the visuals stay bright.
     */
    alwaysDay: boolean;
}

const STORAGE_KEY = 'prometheus.display.v1';

/** Defaults used on first launch or when saved data is missing or unreadable. */
export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = { alwaysDay: false };

/** Loads the saved display settings, falling back to defaults when storage is empty, blocked or corrupt. */
export function loadDisplaySettings(): DisplaySettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<DisplaySettings>;
            return { alwaysDay: parsed.alwaysDay === true };
        }
    } catch { /* fall through to defaults */ }
    return { ...DEFAULT_DISPLAY_SETTINGS };
}

/** Saves the display settings; silently ignores storage failures (private windows, blocked storage). */
export function saveDisplaySettings(settings: DisplaySettings): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}
