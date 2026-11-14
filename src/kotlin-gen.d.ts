/** Type declaration for the Kotlin/Wasm bundle copied into src/kotlin-gen by `./gradlew syncKotlinWasm`. */
declare module '*Project-Prometheus-wasm-js.mjs' {
    /** Kotlin: generateTerrainJson(seed, size) in src/wasmJsMain/kotlin/TerrainExport.kt */
    export function generateTerrainJson(seed: number, size: number): string;
    /** Kotlin: src/wasmJsMain/kotlin/SimulationExport.kt. Creates the world and returns its terrain JSON. */
    export function createSimulation(seed: number, size: number, speciesConfig: string): string;
    /** Static species + scenery JSON (see SimInfo). */
    export function getSimulationInfo(): string;
    /** Advances the simulation by `ticks` ticks. */
    export function tickSimulation(ticks: number): void;
    /** Current state JSON (see SimSnapshot). */
    export function getSimulationSnapshot(): string;
}
