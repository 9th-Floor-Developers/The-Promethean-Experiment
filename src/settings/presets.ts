/** Presets: named, saved bundles of simulation settings. One preset is active and is what Start Simulation runs. */
import {
    BRAIN_NOISE, CARCASS_ROT_HOURS, MAP_SIZE, RESOURCE, defaultSettings, herbivoreTemplate, loadLegacySettings, sanitizeSettings, withFixedLooks, type SimSettings, type SpeciesSettings,
} from './speciesSettings';

/** Which built-in preset a preset started as (so it can be reset to its original); absent for the user's own. */
export type BuiltInKey = 'default' | 'paradise' | 'savanna' | 'learning' | 'dayNight' | 'intelligence';

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
const BUILT_IN_KEYS: BuiltInKey[] = ['default', 'paradise', 'savanna', 'learning', 'dayNight', 'intelligence'];

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
            traits: ['HARD_CODED', 'HERBIVORE', 'LIVE_BIRTH', 'FUR', 'DIURNAL', 'SPRINTING', 'ALARM_CALLING'] },
        { uid: 0, name: 'Leopard tortoise', count: 45, stats: { maxHp: 200, speed: 0.045, damage: 0.5, armor: 60, viewRange: 10 },
            mutationRate: 5,
            traits: ['HARD_CODED', 'HERBIVORE', 'EGG_BIRTH', 'SHELL', 'DIURNAL', 'HARD_SKIN', 'REGENERATION'] },
        { uid: 0, name: 'Lion', count: 6, stats: { maxHp: 140, speed: 0.09, damage: 4, armor: 3, viewRange: 28 },
            mutationRate: 5,
            traits: ['HARD_CODED', 'CARNIVORE', 'LIVE_BIRTH', 'FUR', 'CREPUSCULAR', 'SPRINTING'] },
        { uid: 0, name: 'Spotted hyena', count: 20, stats: { maxHp: 200, speed: 0.1, damage: 2, armor: 5, viewRange: 16 },
            mutationRate: 5,
            traits: ['HARD_CODED', 'SCAVENGER', 'LIVE_BIRTH', 'FUR', 'NOCTURNAL', 'NIGHT_VISION', 'HEARING'] },
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
 * Carcasses rot in 8 hours instead of 3 days: many learners starve, and with long-lasting carrion the hunters fed on
 * those bodies, kept breeding and wiped the learners out (seed 42: hunters 3 -> 33, learners extinct by day 70).
 * Tested on the JVM (seed 42, 80 days): learners stay around 135-185, hunters 3 -> 9.
 */
function learningSettings(): SimSettings {
    const species: Omit<SpeciesSettings, 'look'>[] = [ // looks are filled in by builtInSettings
        { uid: 0, name: 'Learner', count: 70, stats: { maxHp: 100, speed: 0.07, damage: 3, armor: 1, viewRange: 16 },
            mutationRate: 5,
            traits: ['SOFT_CODED', 'HERBIVORE', 'LIVE_BIRTH', 'FUR', 'DIURNAL'] },
        { uid: 0, name: 'Hunter', count: 3, stats: { maxHp: 120, speed: 0.075, damage: 3, armor: 1, viewRange: 20 },
            mutationRate: 5,
            traits: ['HARD_CODED', 'CARNIVORE', 'LIVE_BIRTH', 'FUR', 'DIURNAL'] },
    ];
    return sanitizeSettings({ species, mapSize: 160, water: 1.5, trees: 1.5, grass: 1.5, carcassRotHours: 8 })!;
}

/**
 * Day & night, a 200 tile world with two plant eaters and two meat eaters split across the day:
 * - Gazelle: fast, furry daytime grazer that sprints away, calls alarms and listens for them.
 * - Pangolin: slow, scaly, armored night forager with night vision and hard skin.
 * - Wolf: furry, far-sighted dawn-and-dusk hunter with sharp hearing.
 * - Komodo dragon: tough, scaly, egg-laying night hunter with night vision and a venomous bite.
 * Relies on hunters leaving other hunters alone (Brain.isPrey); before that rule one meat eater always wiped out the other.
 * Tested on the JVM (100 days, seeds 1, 2, 3, 7, 42, 100): all four species alive at day 100 on every seed, though
 * thin on some (seed 100 ended with 1 pangolin, seed 3 with 2 wolves). Starting counts, resources and stats were
 * tuned together, so small changes can tip one herbivore into outcompeting the other.
 */
function dayNightSettings(): SimSettings {
    const species: Omit<SpeciesSettings, 'look'>[] = [ // looks are filled in by builtInSettings
        { uid: 0, name: 'Gazelle', count: 30, stats: { maxHp: 90, speed: 0.08, damage: 1, armor: 1, viewRange: 18 },
            mutationRate: 5,
            traits: ['HARD_CODED', 'HERBIVORE', 'LIVE_BIRTH', 'FUR', 'DIURNAL', 'SPRINTING', 'ALARM_CALLING', 'HEARING'] },
        { uid: 0, name: 'Pangolin', count: 40, stats: { maxHp: 140, speed: 0.06, damage: 1, armor: 30, viewRange: 12 },
            mutationRate: 5,
            traits: ['HARD_CODED', 'HERBIVORE', 'LIVE_BIRTH', 'SCALES', 'NOCTURNAL', 'NIGHT_VISION', 'HARD_SKIN'] },
        { uid: 0, name: 'Wolf', count: 6, stats: { maxHp: 100, speed: 0.09, damage: 3, armor: 1, viewRange: 30 },
            mutationRate: 5,
            traits: ['HARD_CODED', 'CARNIVORE', 'LIVE_BIRTH', 'FUR', 'CREPUSCULAR', 'HEARING'] },
        { uid: 0, name: 'Komodo dragon', count: 6, stats: { maxHp: 160, speed: 0.075, damage: 5, armor: 10, viewRange: 18 },
            mutationRate: 5,
            traits: ['HARD_CODED', 'CARNIVORE', 'EGG_BIRTH', 'SCALES', 'NOCTURNAL', 'NIGHT_VISION', 'VENOMOUS'] },
    ];
    return sanitizeSettings({ species, mapSize: 200, water: 1, trees: 1, grass: 1, carcassRotHours: CARCASS_ROT_HOURS.default })!;
}

// INTELLIGENCE-PRESET-START (tuned with src/jvmMain/kotlin/IntelligenceExperiment.kt)
/**
 * Intelligence pays, a small (100 tile) world built to show bigger brains living longer:
 * - Clever scuttler: a neural-network omnivore that eats plants, eggs and carcasses and hunts the grazers. Its brain
 *   mutates quickly (15%), so many brain sizes live side by side.
 * - Stinging grazer: an instinct-driven night grazer competing for the same plants.
 * Decision noise 5: a founder-sized brain chooses almost at random, and the noise falls with the square of a brain's
 * connections, so smarter scuttlers find food and water more reliably and outlive the rest (each neuron still costs
 * stamina). Tested on the JVM (IntelligenceExperiment, 30 days, seeds 1-8): intelligence vs lifespan r = 0.43
 * (every seed at least 0.38), both species alive on every seed. With decision noise off, r is 0.14.
 */
function intelligenceSettings(): SimSettings {
    const species: Omit<SpeciesSettings, 'look'>[] = [ // looks are filled in by builtInSettings
        { uid: 0, name: 'Clever scuttler', count: 98, stats: { maxHp: 52, speed: 0.099, damage: 2.8, armor: 15.7, viewRange: 14 },
            mutationRate: 15,
            traits: ['SOFT_CODED', 'OMNIVORE', 'EGG_BIRTH', 'EXOSKELETON', 'DIURNAL', 'ALARM_CALLING'] },
        { uid: 0, name: 'Stinging grazer', count: 71, stats: { maxHp: 142, speed: 0.069, damage: 1, armor: 23.5, viewRange: 9 },
            mutationRate: 5,
            traits: ['HARD_CODED', 'HERBIVORE', 'EGG_BIRTH', 'EXOSKELETON', 'NOCTURNAL', 'VENOMOUS'] },
    ];
    return sanitizeSettings({ species, mapSize: 100, water: 1.5, trees: 2, grass: 1, carcassRotHours: 48, brainNoise: 5 })!;
}
// INTELLIGENCE-PRESET-END

const STORAGE_KEY = 'prometheus.presets.v1';

/** The settings of a built-in preset, freshly created. Built-in species always get the same (name-based) looks. */
export function builtInSettings(key: BuiltInKey): SimSettings {
    return withFixedLooks(builtInSettingsRaw(key));
}

/** The settings of a built-in preset before its fixed looks are applied. */
function builtInSettingsRaw(key: BuiltInKey): SimSettings {
    if (key === 'savanna') return savannaSettings();
    if (key === 'learning') return learningSettings();
    if (key === 'dayNight') return dayNightSettings();
    if (key === 'intelligence') return intelligenceSettings();
    if (key === 'paradise') {
        return { species: [{ ...herbivoreTemplate(), name: 'Herbivore', count: 60 }], mapSize: MAP_SIZE.max, water: RESOURCE.max, trees: RESOURCE.max, grass: RESOURCE.max, carcassRotHours: CARCASS_ROT_HOURS.default, brainNoise: BRAIN_NOISE.default };
    }
    return { ...defaultSettings(), mapSize: 200 };
}

const BUILT_IN_NAMES: Record<BuiltInKey, string> = { default: 'Default (predator & prey)', paradise: 'Paradise', savanna: 'Savanna (4 species)', learning: 'Learning lab (neural network)', dayNight: 'Day & night (2 hunters, 2 grazers)', intelligence: 'Intelligence pays (big brains live longer)' };

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
