/** Presets: named, saved bundles of simulation settings. One preset is active and is what Start Simulation runs. */
import {
    MAP_SIZE, RESOURCE, defaultSettings, herbivoreTemplate, loadLegacySettings, sanitizeSettings, withFixedLooks, type SimSettings, type SpeciesSettings,
} from './speciesSettings';

/** Which built-in preset a preset started as (so it can be reset to its original); absent for the user's own. */
export type BuiltInKey = 'default' | 'paradise' | 'savanna' | 'learning';

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
    /** Built-in presets this store has already been given, so a newly added built-in shows up once but a deleted one stays deleted. */
    seenBuiltIns?: BuiltInKey[];
}

/** Every built-in preset, in the order they are listed. */
const BUILT_IN_KEYS: BuiltInKey[] = ['default', 'paradise', 'savanna', 'learning'];

/**
 * African savanna, a medium (180 tile) world with four species modelled loosely on real animals:
 * - Zebra: plentiful herding grazer, the lions' main prey.
 * - Leopard tortoise: slow, heavily armored, self-healing egg layer; hard to kill, though its eggs feed the meat eaters.
 * - Lion: a few pack hunters at dawn and dusk; strong bite, sharp eyes.
 * - Spotted hyena: a tough nocturnal scavenger living off kills, starved animals and eggs. Short eyesight on
 *   purpose: fear grows with how far an animal sees, and far-sighted hyenas fled lions until they starved.
 * Tuned with headless runs (40 in-game days, several seeds); it is not stable on every seed, the hyenas and
 * tortoises can still die out.
 */
function savannaSettings(): SimSettings {
    const species: Omit<SpeciesSettings, 'look'>[] = [ // looks are filled in by builtInSettings
        { uid: 0, name: 'Zebra', count: 60, stats: { maxHp: 110, speed: 0.08, damage: 1, armor: 2, viewRange: 18 },
            mutationRate: 5,
            traits: ['HARD_CODED', 'HERBIVORE', 'LIVE_BIRTH', 'FUR', 'ENDOTHERMIC', 'DIURNAL', 'SPRINTING', 'ALARM_CALLING'] },
        { uid: 0, name: 'Leopard tortoise', count: 45, stats: { maxHp: 200, speed: 0.045, damage: 0.5, armor: 60, viewRange: 10 },
            mutationRate: 5,
            traits: ['HARD_CODED', 'HERBIVORE', 'EGG_BIRTH', 'SHELL', 'ECTOTHERMIC', 'DIURNAL', 'HARD_SKIN', 'REGENERATION'] },
        { uid: 0, name: 'Lion', count: 6, stats: { maxHp: 140, speed: 0.09, damage: 4, armor: 3, viewRange: 28 },
            mutationRate: 5,
            traits: ['HARD_CODED', 'CARNIVORE', 'LIVE_BIRTH', 'FUR', 'ENDOTHERMIC', 'CREPUSCULAR', 'SPRINTING'] },
        { uid: 0, name: 'Spotted hyena', count: 20, stats: { maxHp: 200, speed: 0.1, damage: 2, armor: 5, viewRange: 16 },
            mutationRate: 5,
            traits: ['HARD_CODED', 'SCAVENGER', 'LIVE_BIRTH', 'FUR', 'ENDOTHERMIC', 'NOCTURNAL', 'NIGHT_VISION', 'HEARING'] },
    ];
    // sanitizeSettings hands out real uids (and clamps every stat to its allowed range).
    return sanitizeSettings({ species, mapSize: 180, water: 1.25, trees: 1, grass: 1.25 })!;
}

/**
 * Learning lab, a 160 tile world with plenty of water, trees and grass, showing the neural-network brain (SOFT CODED AI) at work:
 * - Learner: a neural-network herbivore. Founders start with random brains, so many die of thirst and hunger in the
 *   first days; the survivors learn, also from watching each other, so the population then recovers and grows.
 * - Hunter: a few slow, instinct-driven carnivores that keep some pressure on the learners.
 * Watch the population graph: an early crash of the learners followed by steady growth is the learning curve.
 * Tested on the JVM (seed 42): learners 70 -> 88 on day 1, dipping to 72 by day 3, then 186 by day 15; hunters 3 -> 5.
 */
function learningSettings(): SimSettings {
    const species: Omit<SpeciesSettings, 'look'>[] = [ // looks are filled in by builtInSettings
        { uid: 0, name: 'Learner', count: 70, stats: { maxHp: 100, speed: 0.07, damage: 3, armor: 1, viewRange: 16 },
            mutationRate: 5,
            traits: ['SOFT_CODED', 'HERBIVORE', 'LIVE_BIRTH', 'FUR', 'ENDOTHERMIC', 'DIURNAL'] },
        { uid: 0, name: 'Hunter', count: 3, stats: { maxHp: 120, speed: 0.075, damage: 3, armor: 1, viewRange: 20 },
            mutationRate: 5,
            traits: ['HARD_CODED', 'CARNIVORE', 'LIVE_BIRTH', 'FUR', 'ENDOTHERMIC', 'DIURNAL'] },
    ];
    return sanitizeSettings({ species, mapSize: 160, water: 1.5, trees: 1.5, grass: 1.5 })!;
}

const STORAGE_KEY = 'prometheus.presets.v1';

/** The settings of a built-in preset, freshly created. Built-in species always get the same (name-based) looks. */
export function builtInSettings(key: BuiltInKey): SimSettings {
    return withFixedLooks(builtInSettingsRaw(key));
}

/** The settings of a built-in preset before its fixed looks are applied. */
function builtInSettingsRaw(key: BuiltInKey): SimSettings {
    if (key === 'savanna') return savannaSettings();
    if (key === 'learning') return learningSettings();
    if (key === 'paradise') {
        return { species: [{ ...herbivoreTemplate(), name: 'Herbivore', count: 60 }], mapSize: MAP_SIZE.max, water: RESOURCE.max, trees: RESOURCE.max, grass: RESOURCE.max };
    }
    return { ...defaultSettings(), mapSize: 200 };
}

const BUILT_IN_NAMES: Record<BuiltInKey, string> = { default: 'Default (predator & prey)', paradise: 'Paradise', savanna: 'Savanna (4 species)', learning: 'Learning lab (neural network)' };

function builtInPreset(key: BuiltInKey): Preset {
    return { id: `builtin-${key}`, name: BUILT_IN_NAMES[key], settings: builtInSettings(key), builtIn: key };
}

/** The presets a fresh install starts with: every built-in preset. */
export function defaultStore(): PresetStore {
    return { presets: BUILT_IN_KEYS.map(builtInPreset), activeId: 'builtin-default', seenBuiltIns: [...BUILT_IN_KEYS] };
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
            if (presets.length > 0) {
                // Stores saved before seenBuiltIns existed had exactly the default and Paradise built-ins.
                const seen = Array.isArray(parsed.seenBuiltIns) ? parsed.seenBuiltIns : ['default', 'paradise'] as BuiltInKey[];
                for (const key of BUILT_IN_KEYS) if (!seen.includes(key)) presets.push(builtInPreset(key));
                return { presets, activeId: presets.some((p) => p.id === parsed.activeId) ? parsed.activeId : presets[0]!.id, seenBuiltIns: [...BUILT_IN_KEYS] };
            }
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
