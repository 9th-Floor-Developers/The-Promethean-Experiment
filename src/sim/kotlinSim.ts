import type { TerrainData, TileTypeInfo } from '../terrain/types';
import type { SimInfo, SimSnapshot } from './types';

/** Shape of the JSON produced by Kotlin's terrainToJson. */
interface TerrainJson {
    width: number;
    height: number;
    tileTypes: TileTypeInfo[];
    tiles: string;
}

/** Handle to the running Kotlin simulation (compiled to WebAssembly). */
export interface KotlinSimulation {
    readonly terrain: TerrainData;
    readonly info: SimInfo;
    /** Advances the simulation by `ticks` ticks (1200 ticks = one in-game day). */
    tick(ticks: number): void;
    /** Reads the current state. */
    snapshot(): SimSnapshot;
}

/**
 * Creates the simulation by running the Kotlin code in WebAssembly. The Wasm module is loaded lazily.
 * Requires `src/kotlin-gen`, which `npm run dev` / `npm run build` create via `./gradlew syncKotlinWasm`.
 * The terrain returned is the simulation's own terrain, so what is drawn is what the animals walk on.
 */
export async function createSimulation(seed = 42, size = 200): Promise<KotlinSimulation> {
    const kotlin = await import('../kotlin-gen/Project-Prometheus-wasm-js.mjs');
    const json = JSON.parse(kotlin.createSimulation(seed, size)) as TerrainJson;
    return {
        terrain: {
            width: json.width,
            height: json.height,
            tileTypes: json.tileTypes,
            tiles: Uint8Array.from(json.tiles, (ch) => Number(ch)),
        },
        info: JSON.parse(kotlin.getSimulationInfo()) as SimInfo,
        tick: (ticks) => kotlin.tickSimulation(ticks),
        snapshot: () => JSON.parse(kotlin.getSimulationSnapshot()) as SimSnapshot,
    };
}
