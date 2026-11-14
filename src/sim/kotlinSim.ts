import type { TerrainData, TileTypeInfo } from '../terrain/types';
import type { ObjectInfo, SimInfo, SimSnapshot } from './types';

/** Shape of the JSON produced by Kotlin's terrainToJson. */
interface TerrainJson {
    width: number;
    height: number;
    tileTypes: TileTypeInfo[];
    tiles: string;
}

/** Resource amount multipliers (1 = default) for ponds, trees and grass. */
export interface Resources { water: number; trees: number; grass: number }

/** Handle to the running Kotlin simulation (compiled to WebAssembly). */
export interface KotlinSimulation {
    readonly terrain: TerrainData;
    readonly info: SimInfo;
    /** Advances the simulation by `ticks` ticks (1200 ticks = one in-game day). */
    tick(ticks: number): void;
    /** Reads the current state. */
    snapshot(): SimSnapshot;
    /** Waypoints (tile units) an animal follows around obstacles, flat [x0,y0,x1,y1,...]; empty when it walks straight. */
    animalPath(id: number): number[];
    /** Details of a tree, grass tuft, carcass or egg, or null when no such object exists (any more). */
    objectInfo(id: number): ObjectInfo | null;
}

/**
 * Creates the simulation by running the Kotlin code in WebAssembly. The Wasm module is loaded lazily.
 * Requires `src/kotlin-gen`, which `npm run dev` / `npm run build` create via `./gradlew syncKotlinWasm`.
 * `speciesConfig` is the Settings text (see settings/speciesSettings.ts toSpeciesConfig); empty = default species.
 * The terrain returned is the simulation's own terrain, so what is drawn is what the animals walk on.
 */
export async function createSimulation(seed = 42, size = 200, speciesConfig = '', resources: Resources = { water: 1, trees: 1, grass: 1 }, looks: readonly number[] = []): Promise<KotlinSimulation> {
    const kotlin = await import('../kotlin-gen/Project-Prometheus-wasm-js.mjs');
    const json = JSON.parse(kotlin.createSimulation(seed, size, speciesConfig, resources.water, resources.trees, resources.grass)) as TerrainJson;
    // Kotlin knows nothing about appearance; species come back in config order, so attach each one's look by index.
    const info = JSON.parse(kotlin.getSimulationInfo()) as Omit<SimInfo, 'species'> & { species: Omit<SimInfo['species'][number], 'look'>[] };
    const withLooks: SimInfo = { ...info, species: info.species.map((sp, i) => ({ ...sp, look: looks[i] ?? i })) };
    return {
        terrain: {
            width: json.width,
            height: json.height,
            tileTypes: json.tileTypes,
            tiles: Uint8Array.from(json.tiles, (ch) => Number(ch)),
        },
        info: withLooks,
        tick: (ticks) => kotlin.tickSimulation(ticks),
        snapshot: () => JSON.parse(kotlin.getSimulationSnapshot()) as SimSnapshot,
        animalPath: (id) => JSON.parse(kotlin.getAnimalPath(id)) as number[],
        objectInfo: (id) => JSON.parse(kotlin.getObjectInfo(id)) as ObjectInfo | null,
    };
}
