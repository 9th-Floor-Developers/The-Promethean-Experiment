/** Phases of the Kotlin day-night cycle (sim.world.TimePhase). */
export type TimePhase = 'NIGHT' | 'DAWN' | 'DAY' | 'DUSK';

/** Static simulation facts from Kotlin's getSimulationInfo(). Positions are in tile units. */
export interface SpeciesInfo {
    name: string;
    canHunt: boolean;
    traits: string[];
    maxHp: number;
    maxNutrition: number;
    maxHydration: number;
    maxStamina: number;
    /** Distance in tiles at which animals of this species see food, mates and predators. */
    viewRange: number;
    /** Trait SPRINTING: the sprint reserve, in ticks of sprinting, a fully rested animal of this species holds. */
    sprintChargeTicks: number;
    /** Trait HEARING: distance in tiles at which this species picks up alarm calls and the noise of moving animals. */
    hearingRange: number;
    /** The species' base (founder) universal stats from Settings, in the order of TRAIT_AXES (max HP, speed, damage, armor, view range, base stamina use, walking stamina use, elderly age, intelligence). Intelligence is -1 for a species without a neural network. */
    base: number[];
    /** Seed of the species' random appearance (scene/animalLook.ts), attached from Settings when the world is built. */
    look: number;
}

/** Details of a selected non-animal object from Kotlin's getObjectInfo(). Positions are in tile units. */
export type ObjectInfo =
    | { type: 'TREE' | 'GRASS'; x: number; y: number; edible: boolean; cooldownRemaining: number; cooldownTicks: number; nutrition: number }
    | { type: 'CARCASS'; x: number; y: number; nutrition: number; initialNutrition: number; rotTicksLeft: number; rotTicks: number }
    | { type: 'EGG'; x: number; y: number; species: string; hatchTicks: number; ticksLeft: number; nutrition: number };

export interface SimInfo {
    /** Action names, indexed by an animal row's action code (see A.action). */
    actions: string[];
    species: SpeciesInfo[];
    /** [id, type (1 = tree, 2 = grass), x, y]. Trees and grass are in the same order as SimSnapshot.trees and SimSnapshot.grass. */
    scenery: [number, number, number, number][];
}

/** Value of an animal row's heading column when the animal has no direction of travel. */
export const NO_HEADING = 999;

/**
 * Column indices of a SimSnapshot.animals row:
 * [id, species, x, y, hp, nutrition, hydration, stamina, age, action, fear, hunger, thirst, libido, targetX, targetY, heading] (target is -1,-1 when the animal has no destination; heading is
 * the direction in radians a wandering or fleeing animal moves in, NO_HEADING when it has none; the last eight are the animal's own stats: inherited maxHp, speed, damage, armor, viewRange, then calculated
 * baseStaminaUsage, walkingStaminaUsage, elderlyAge), then intelligence: the size of its neural network in hidden neurons, or -1 when it has none (instinct brain),
 * then sprintCharge: the sprint reserve left in ticks, and sprinting: 1 while the animal is sprinting (both 0 without the SPRINTING trait),
 * then calling: 1 while the animal is raising an alarm (ALARM_CALLING).
 */
export const A = {
    id: 0, species: 1, x: 2, y: 3, hp: 4, nutrition: 5, hydration: 6, stamina: 7, age: 8,
    action: 9, fear: 10, hunger: 11, thirst: 12, libido: 13, targetX: 14, targetY: 15, heading: 16,
    maxHp: 17, speed: 18, damage: 19, armor: 20, viewRange: 21,
    baseStaminaUsage: 22, walkingStaminaUsage: 23, elderlyAge: 24, intelligence: 25,
    sprintCharge: 26, sprinting: 27, calling: 28,
} as const;

/** A neural-network (SOFT_CODED) animal's brain from Kotlin's getAnimalBrain(). */
export interface BrainInfo {
    /** Neurons per layer: inputs, hidden layers..., outputs. */
    sizes: number[];
    /** Per layer, its weights row-major: `sizes[l + 1]` rows (target neuron) of `sizes[l]` (source neuron). */
    weights: number[][];
    /** What the animal sensed this tick, in the order of BRAIN_INPUTS. */
    inputs: number[];
    /** The network's value for each drive, in the order of BRAIN_OUTPUTS; the highest is what it wants most. */
    outputs: number[];
    /** How many of its own decisions, and of decisions it saw others of its species make, it remembers. */
    own: number;
    observed: number;
}

/** Names of the brain inputs (Kotlin Brain.sense), in order. */
export const BRAIN_INPUTS = ['Health', 'Food', 'Water', 'Stamina', 'Age', 'Ready to breed', 'Predator near', 'Food near', 'Water near', 'Mate near', 'Time (sin)', 'Time (cos)', 'Awake time'];
/** Names of the brain outputs (Kotlin Drive), in order. */
export const BRAIN_OUTPUTS = ['Flee', 'Eat', 'Drink', 'Mate', 'Rest', 'Explore'];

/** Current simulation state from Kotlin's getSimulationSnapshot(). */
export interface SimSnapshot {
    tick: number;
    /** Day number, starting at 1. */
    day: number;
    /** 0.0 = midnight, 0.5 = noon, up to 1.0. */
    timeOfDay: number;
    phase: TimePhase;
    animals: number[][];
    /** [id, x, y, fractionOfNutritionLeft] */
    carcasses: [number, number, number, number][];
    /** [id, x, y, hatchProgress 0..1] of eggs that have not hatched or been eaten. */
    eggs: [number, number, number, number][];
    /** Running totals since the run began: [killed by other animals, died of starvation/thirst/other natural causes]. */
    deaths: [number, number];
    /** Running totals per species (indexed like SimInfo.species): [deaths from starvation or thirst, animal-ticks lived]. */
    perSpecies?: [number, number][];
    /** One char per tree, '1' = edible, '0' = cooling down. */
    trees: string;
    /** One char per grass tuft, '1' = edible, '0' = cooling down. */
    grass: string;
}

/** Formats a snapshot's time of day as "HH:MM". */
export function formatTime(timeOfDay: number): string {
    const minutes = Math.floor(timeOfDay * 24 * 60) % (24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
