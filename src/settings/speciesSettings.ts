/** User-editable simulation settings: which species run, how many of each, and their stats and traits. */

/** Key of a universal stat; matches the keys Kotlin's parseSpeciesConfig reads. */
export type StatKey = 'maxHp' | 'speed' | 'damage' | 'armor' | 'viewRange';

/** How one universal stat is shown: plain-language name, help text and slider range. */
export interface StatDef {
    key: StatKey;
    label: string;
    help: string;
    min: number;
    max: number;
    step: number;
    /** Words shown at the low and high end of the slider. */
    low: string;
    high: string;
    unit: string;
}

/** The inherited species stats (docs/sim/SPECIES.md), described without jargon. These are the founders' values; later generations mix their parents' and mutate. */
export const STATS: StatDef[] = [
    { key: 'maxHp', label: 'Health', help: 'How much damage it can take before it dies.', min: 20, max: 300, step: 10, low: 'Fragile', high: 'Tough', unit: '' },
    { key: 'speed', label: 'Speed', help: 'How fast it walks when it has full energy.', min: 0.02, max: 0.2, step: 0.01, low: 'Slow', high: 'Fast', unit: '' },
    { key: 'viewRange', label: 'Eyesight', help: 'How far it can see food, water, mates and enemies.', min: 4, max: 40, step: 1, low: 'Short-sighted', high: 'Eagle-eyed', unit: ' tiles' },
    { key: 'damage', label: 'Bite strength', help: 'Damage it deals each moment while attacking. Animals that do not hunt can leave this at 0.', min: 0, max: 10, step: 0.5, low: 'Harmless', high: 'Deadly', unit: '' },
    { key: 'armor', label: 'Armor', help: 'Percent of incoming attack damage it shrugs off (at most 80%).', min: 0, max: 60, step: 5, low: 'Soft', high: 'Armored', unit: '%' },
];

/** One selectable trait with a friendly name and a one-line explanation. */
export interface TraitOption {
    id: string;
    label: string;
    help: string;
    /** Trait is listed but the simulation cannot use it yet. */
    unavailable?: boolean;
}

/** A group of traits of which a species picks exactly one. */
export interface TraitCategoryDef {
    key: string;
    label: string;
    question: string;
    options: TraitOption[];
}

/** The categorized traits (one choice per category). */
export const CATEGORIES: TraitCategoryDef[] = [
    { key: 'CONTROLLER', label: 'Brain', question: 'How does it make decisions?', options: [
        { id: 'HARD_CODED', label: 'Instinct', help: 'Follows built-in rules driven by fear, hunger, thirst and the urge to breed.' },
        { id: 'SOFT_CODED', label: 'Neural network', help: 'Learns its own behaviour (not available yet).', unavailable: true },
    ] },
    { key: 'CONSUMPTION', label: 'Diet', question: 'What does it eat?', options: [
        { id: 'HERBIVORE', label: 'Plants only', help: 'Eats trees and grass.' },
        { id: 'CARNIVORE', label: 'Meat only', help: 'Hunts other animals and eats carcasses.' },
        { id: 'OMNIVORE', label: 'Plants and meat', help: 'Eats plants, hunts animals and eats carcasses.' },
        { id: 'SCAVENGER', label: 'Leftovers', help: 'Only eats animals that are already dead.' },
    ] },
    { key: 'BIRTHING', label: 'Birth', question: 'How are babies born?', options: [
        { id: 'LIVE_BIRTH', label: 'Live birth', help: 'Babies grow inside the parent.' },
        { id: 'EGG_BIRTH', label: 'Eggs', help: 'Babies grow in an egg outside the parent.' },
        { id: 'POUCH_BIRTH', label: 'Pouch', help: 'Babies finish growing in a pouch.' },
    ] },
    { key: 'BODY_COVERING', label: 'Body covering', question: 'What covers its body?', options: [
        { id: 'FUR', label: 'Fur', help: 'A coat of hair or fur.' },
        { id: 'FEATHERS', label: 'Feathers', help: 'Feathers cover its body.' },
        { id: 'SCALES', label: 'Scales', help: 'Scales cover its body.' },
        { id: 'EXOSKELETON', label: 'Hard outer skeleton', help: 'A hard external skeleton.' },
        { id: 'BARE_SKIN', label: 'Bare skin', help: 'Exposed skin.' },
        { id: 'SHELL', label: 'Shell', help: 'A hard protective shell.' },
    ] },
    { key: 'BODY_TEMPERATURE', label: 'Body heat', question: 'How does it stay warm?', options: [
        { id: 'ENDOTHERMIC', label: 'Warm-blooded', help: 'Makes its own body heat.' },
        { id: 'ECTOTHERMIC', label: 'Cold-blooded', help: 'Relies on the sun and surroundings for heat.' },
    ] },
    { key: 'ACTIVITY_CYCLE', label: 'Daily schedule', question: 'When is it awake?', options: [
        { id: 'DIURNAL', label: 'Daytime', help: 'Active during the day and rests otherwise.' },
        { id: 'NOCTURNAL', label: 'Nighttime', help: 'Active at night and rests otherwise.' },
        { id: 'CREPUSCULAR', label: 'Dawn and dusk', help: 'Active around sunrise and sunset.' },
    ] },
    { key: 'SOCIAL_BEHAVIOR', label: 'Social life', question: 'Does it live with others?', options: [
        { id: 'SOLITARY', label: 'Loner', help: 'Lives on its own.' },
        { id: 'HERDING', label: 'Herd', help: 'Lives and moves in groups.' },
        { id: 'PACK', label: 'Pack', help: 'Lives and hunts in coordinated groups.' },
    ] },
];

/** Optional traits that can be switched on in any combination. */
export const EXTRA_TRAITS: TraitOption[] = [
    { id: 'CLIMBING', label: 'Climbing', help: 'Can climb trees and steep places.' },
    { id: 'SPRINTING', label: 'Sprinting', help: 'Can sprint for a short time.' },
    { id: 'VENOMOUS', label: 'Venomous', help: 'Its bite or sting harms others.' },
    { id: 'POISONOUS', label: 'Poisonous', help: 'Harms anything that eats it.' },
    { id: 'ARMOR', label: 'Armor', help: 'Protective plating or structures.' },
    { id: 'SPIKES', label: 'Spikes', help: 'Sharp spines that discourage predators.' },
    { id: 'REGENERATION', label: 'Self-healing', help: 'Slowly heals itself while fed and watered.' },
    { id: 'ALARM_CALLING', label: 'Alarm calls', help: 'Warns nearby animals of danger.' },
    { id: 'NIGHT_VISION', label: 'Night vision', help: 'Sees well in the dark.' },
    { id: 'HEARING', label: 'Sharp hearing', help: 'Can detect sounds.' },
];

/** Settings for one species. `traits` holds every chosen trait id (one per category plus any extras). */
export interface SpeciesSettings {
    /** Stable key for React lists. */
    uid: number;
    name: string;
    /** How many animals of this species the simulation starts with. */
    count: number;
    stats: Record<StatKey, number>;
    traits: string[];
}

/** All user-editable simulation settings. */
export interface SimSettings {
    species: SpeciesSettings[];
    /** Width and height of the (square) world map, in tiles. */
    mapSize: number;
    /** Resource amounts as multipliers of the default (1 = normal). */
    water: number;
    trees: number;
    grass: number;
}

/** Resource amount slider limits (multiplier of the default amount). */
export const RESOURCE = { min: 0.25, max: 3, step: 0.25 } as const;

/** World map size limits (tiles per side) and default. */
export const MAP_SIZE = { min: 60, max: 300, step: 10, default: 200 } as const;

/** Most species allowed; the graph and legends have six distinct colours. */
export const MAX_SPECIES = 6;
export const MIN_COUNT = 1;
export const MAX_COUNT = 150;
export const DEFAULT_STATS: Record<StatKey, number> = { maxHp: 100, speed: 0.07, damage: 0, armor: 0, viewRange: 16 };

let nextUid = 1;

/** A plant-eating species starting point. */
export function herbivoreTemplate(): SpeciesSettings {
    return {
        uid: nextUid++, name: 'Herbivore', count: 40, stats: { ...DEFAULT_STATS },
        traits: ['HARD_CODED', 'HERBIVORE', 'LIVE_BIRTH', 'FUR', 'ENDOTHERMIC', 'DIURNAL', 'HERDING'],
    };
}

/** A meat-eating species starting point. */
export function carnivoreTemplate(): SpeciesSettings {
    return {
        uid: nextUid++, name: 'Carnivore', count: 10, stats: { ...DEFAULT_STATS, speed: 0.09, damage: 3, viewRange: 30 },
        traits: ['HARD_CODED', 'CARNIVORE', 'LIVE_BIRTH', 'FUR', 'ENDOTHERMIC', 'CREPUSCULAR', 'PACK'],
    };
}

/** The settings the simulation starts with: one predator and one prey species. */
export function defaultSettings(): SimSettings {
    return { species: [carnivoreTemplate(), herbivoreTemplate()], mapSize: MAP_SIZE.default, water: 1, trees: 1, grass: 1 };
}

/** Name for a new species that does not clash with an existing one. */
export function newSpeciesName(existing: SpeciesSettings[]): string {
    for (let i = existing.length + 1; ; i++) if (!existing.some((s) => s.name === `Species ${i}`)) return `Species ${i}`;
}

/** Serialises settings into the line format Kotlin's parseSpeciesConfig reads: `name|count|key=value,...|TRAIT,...`. */
export function toSpeciesConfig(settings: SimSettings): string {
    return settings.species.map((s) => {
        const name = (s.name.replace(/[|"\\\n]/g, '').trim() || 'Species');
        const stats = (Object.keys(s.stats) as StatKey[]).map((k) => `${k}=${s.stats[k]}`).join(',');
        return `${name}|${Math.max(MIN_COUNT, Math.min(MAX_COUNT, Math.round(s.count)))}|${stats}|${s.traits.join(',')}`;
    }).join('\n');
}

const STORAGE_KEY = 'prometheus.settings.v1';

/**
 * Validates settings read from storage (clamping numbers, filling missing stats) and gives every species a fresh uid.
 * Returns null if `raw` is not usable settings. Also used to deep-copy settings.
 */
export function sanitizeSettings(raw: unknown): SimSettings | null {
    const parsed = raw as Partial<SimSettings> | null;
    if (!parsed || !Array.isArray(parsed.species) || parsed.species.length === 0) return null;
    const res = (v: unknown) => Math.max(RESOURCE.min, Math.min(RESOURCE.max, Number(v) || 1));
    return {
        water: res(parsed.water), trees: res(parsed.trees), grass: res(parsed.grass),
        mapSize: Math.max(MAP_SIZE.min, Math.min(MAP_SIZE.max, Number(parsed.mapSize) || MAP_SIZE.default)),
        species: parsed.species.map((s) => ({ ...s, uid: nextUid++, stats: { ...DEFAULT_STATS, ...s.stats }, traits: [...s.traits] })),
    };
}

/** Settings saved by the version before presets existed, or null; used once to migrate them into a preset. */
export function loadLegacySettings(): SimSettings | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? sanitizeSettings(JSON.parse(raw)) : null;
    } catch { return null; }
}
