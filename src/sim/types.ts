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
}

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
 * baseStaminaUsage, walkingStaminaUsage, elderlyAge).
 */
export const A = {
    id: 0, species: 1, x: 2, y: 3, hp: 4, nutrition: 5, hydration: 6, stamina: 7, age: 8,
    action: 9, fear: 10, hunger: 11, thirst: 12, libido: 13, targetX: 14, targetY: 15, heading: 16,
    maxHp: 17, speed: 18, damage: 19, armor: 20, viewRange: 21,
    baseStaminaUsage: 22, walkingStaminaUsage: 23, elderlyAge: 24,
} as const;

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
