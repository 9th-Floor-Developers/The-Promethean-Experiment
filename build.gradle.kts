plugins {
    kotlin("multiplatform") version "2.1.20"
}

repositories { mavenCentral() }

kotlin {
    jvm { mainRun { mainClass.set("MainKt") } }
    @OptIn(org.jetbrains.kotlin.gradle.ExperimentalWasmDsl::class)
    wasmJs {
        browser()
        // Produces the .mjs + .wasm bundle that the Vite frontend imports.
        binaries.executable()
    }
}

/**
 * Compiles the Kotlin simulation to WebAssembly and copies the result into
 * `src/kotlin-gen`, where the TypeScript frontend imports it (see src/sim/kotlinSim.ts).
 */
tasks.register<Sync>("syncKotlinWasm") {
    group = "frontend"
    description = "Build the Kotlin/Wasm simulation and copy it into src/kotlin-gen for Vite."
    dependsOn("wasmJsProductionExecutableCompileSync")
    from(layout.buildDirectory.dir("compileSync/wasmJs/main/productionExecutable/kotlin"))
    into(layout.projectDirectory.dir("src/kotlin-gen"))
}
