/** Presets: named, saved bundles of simulation settings. One preset is active and is what Start Simulation runs. */
import {
    MAP_SIZE, RESOURCE, defaultSettings, herbivoreTemplate, loadLegacySettings, sanitizeSettings, type SimSettings,
} from './speciesSettings';

/** Which built-in preset a preset started as (so it can be reset to its original); absent for the user's own. */
export type BuiltInKey = 'default' | 'paradise';

export interface Preset {
    id: string;
    name: string;
    settings: SimSettings;
    builtIn?: BuiltInKey;
}

/** All presets plus the id of the active one. */
export interface PresetStore {
    presets: Preset[];
    activeId: string;
}

const STORAGE_KEY = 'prometheus.presets.v1';

/** The settings of a built-in preset, freshly created. */
export function builtInSettings(key: BuiltInKey): SimSettings {
    if (key === 'paradise') {
        return { species: [{ ...herbivoreTemplate(), name: 'Herbivore', count: 60 }], mapSize: MAP_SIZE.max, water: RESOURCE.max, trees: RESOURCE.max, grass: RESOURCE.max };
    }
    return { ...defaultSettings(), mapSize: 200 };
}

const BUILT_IN_NAMES: Record<BuiltInKey, string> = { default: 'Default (predator & prey)', paradise: 'Paradise' };

function builtInPreset(key: BuiltInKey): Preset {
    return { id: `builtin-${key}`, name: BUILT_IN_NAMES[key], settings: builtInSettings(key), builtIn: key };
}

/** The presets a fresh install starts with: the two-species default and Paradise. */
export function defaultStore(): PresetStore {
    return { presets: [builtInPreset('default'), builtInPreset('paradise')], activeId: 'builtin-default' };
}

let counter = 0;
/** A unique id for a user-made preset. */
function newId(): string {
    return `p-${Date.now().toString(36)}-${(counter++).toString(36)}`;
}

/** A new preset with the starting predator & prey settings. */
export function createPreset(name = 'New preset'): Preset {
    return { id: newId(), name, settings: { ...defaultSettings() } };
}

/** A copy of `preset` with its own id and species, named "<name> copy". */
export function duplicatePreset(preset: Preset): Preset {
    return { id: newId(), name: `${preset.name} copy`, settings: sanitizeSettings(preset.settings)! };
}

/** Loads saved presets. Settings saved before presets existed are kept as a preset named "My settings". */
export function loadPresetStore(): PresetStore {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as PresetStore;
            const presets = (Array.isArray(parsed.presets) ? parsed.presets : []).flatMap((p): Preset[] => {
                const settings = sanitizeSettings(p.settings);
                return settings && typeof p.id === 'string' ? [{ id: p.id, name: String(p.name ?? 'Preset'), settings, builtIn: p.builtIn }] : [];
            });
            if (presets.length > 0) return { presets, activeId: presets.some((p) => p.id === parsed.activeId) ? parsed.activeId : presets[0]!.id };
        }
    } catch { /* storage blocked or corrupt: fall back to defaults */ }
    const store = defaultStore();
    const legacy = loadLegacySettings();
    if (legacy) {
        const mine: Preset = { id: newId(), name: 'My settings', settings: legacy };
        return { presets: [...store.presets, mine], activeId: mine.id };
    }
    return store;
}

/** Saves the presets so they survive a page reload; failures are ignored. */
export function savePresetStore(store: PresetStore): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* ignore */ }
}

/** The active preset (the first one if the id is somehow missing). */
export function activePreset(store: PresetStore): Preset {
    return store.presets.find((p) => p.id === store.activeId) ?? store.presets[0]!;
}
