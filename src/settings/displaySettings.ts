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
    /** Play the interface click sounds (buttons and dropdowns). On by default; off mutes without losing [uiVolume]. */
    uiSounds: boolean;
    /** Loudness of the interface click sounds, 0 (silent) to 1 (full). */
    uiVolume: number;
    /** Show the floating text above animals: damage numbers, action labels, "Born!" and "Died". */
    showPopups: boolean;
    /** Show the expanding rings drawn when an animal makes an alarm call or sprints. */
    showSoundRings: boolean;
    /** Slowly rotate the island on the menu screens. Off for viewers sensitive to motion; the simulation view never spins. */
    spinIsland: boolean;
    /**
     * Draw every animal as a plain sphere in its species' main colour instead of its detailed model.
     * Easier to tell species apart and to spot animals from far away; behaviour is unchanged.
     */
    sphereAnimals: boolean;
}

const STORAGE_KEY = 'prometheus.display.v1';

/** Defaults used on first launch or when saved data is missing or unreadable. */
export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
    alwaysDay: false, uiSounds: true, uiVolume: 0.6, showPopups: true, showSoundRings: true, spinIsland: true, sphereAnimals: false,
};

/** Loads the saved display settings, falling back to defaults when storage is empty, blocked or corrupt. */
export function loadDisplaySettings(): DisplaySettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<DisplaySettings>;
            const volume = typeof parsed.uiVolume === 'number' && Number.isFinite(parsed.uiVolume)
                ? Math.min(1, Math.max(0, parsed.uiVolume)) : DEFAULT_DISPLAY_SETTINGS.uiVolume;
            return {
                alwaysDay: parsed.alwaysDay === true,
                uiSounds: parsed.uiSounds !== false,
                uiVolume: volume,
                showPopups: parsed.showPopups !== false,
                showSoundRings: parsed.showSoundRings !== false,
                spinIsland: parsed.spinIsland !== false,
                sphereAnimals: parsed.sphereAnimals === true,
            };
        }
    } catch { /* fall through to defaults */ }
    return { ...DEFAULT_DISPLAY_SETTINGS };
}

/** Saves the display settings; silently ignores storage failures (private windows, blocked storage). */
export function saveDisplaySettings(settings: DisplaySettings): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}
