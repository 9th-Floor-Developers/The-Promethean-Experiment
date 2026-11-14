
# Project Genesis — Island Viewport and Camera

Read:
- PROJECT_OVERVIEW.md
- 06_SIMULATION_ARCHITECTURE.md

Inspect the current project and the terrain implementation before modifying anything.

## Objective

Implement the primary Three.js Simulation View.

This is the most important visual component of the simulation screen.

The result should feel like an actual artificial-life environment that a user observes, rather than a 3D model being presented in a portfolio.

## Existing Terrain

Reuse the existing terrain renderer and terrain data integration.

The terrain is represented using Kotlin terrain definitions that will eventually be supplied to Claude.

Do not invent a competing terrain schema.

If terrain data is not currently available:
- Preserve the existing terrain interfaces.
- Use the existing temporary mock data if present.
- Do not redesign the terrain model.

## Visual Direction

The world should resemble a colorful, cute, low-poly miniature island.

The island should:
- Have a clearly visible boundary.
- Have recognizable terrain elevation.
- Contain distinguishable terrain regions.
- Be visually readable from the camera perspective.
- Look like a small environment that organisms could eventually inhabit.

Do not add:
- Animals
- Trees or vegetation unless already supported by the terrain renderer
- Neural networks
- Simulation mechanics
- Unrequested environment objects

## Camera

The camera is observational.

It should remain at a fixed position and orientation relative to the island.

Do NOT implement:
- Automatic orbiting
- Rotating showcase animations
- Camera paths
- Continuous camera movement
- Automatic island rotation

The island should remain stationary.

Choose a camera position that provides a clear elevated perspective.

The entire island should be visible initially, with enough perspective to communicate elevation and terrain shape.

The camera should not be so high that the island becomes a flat map.

The camera should not be so low that terrain boundaries or distant regions are hidden.

## Camera Interaction

For the initial implementation:

- No automatic camera movement.
- No automatic rotation.
- No camera animation.
- No complicated orbit controls.

If basic camera interaction is added, it must be intentional and restrained.

Do not allow the user to accidentally lose the island by rotating the camera underneath the terrain or zooming infinitely.

Keep the camera behavior extensible for later interaction work.

## Rendering

Implement a clean Three.js lifecycle.

- Mount the renderer inside the viewport container.
- Resize correctly when the container changes dimensions.
- Dispose of resources appropriately.
- Avoid duplicate animation loops.
- Avoid recreating the scene on unrelated React state changes.
- Preserve the scene while other UI panels update.

The viewport must integrate with the architecture established in Chat 06.

## Lighting and Materials

Use lighting that makes terrain elevation and low-poly geometry readable.

The world should remain colorful.

Avoid overly realistic rendering, excessive bloom, cinematic post-processing, or distracting effects.

Prioritize clarity and visual consistency.

## Integration

The Three.js scene must occupy only the main simulation viewport.

The React interface should remain outside the WebGL canvas.

Do not draw the inspector or graph using Three.js.

## Deliverables

1. Explain camera placement and viewing strategy.
2. Provide complete contents of every changed/new file.
3. Explain how the renderer integrates with the Simulation page.
4. Explain the renderer lifecycle and cleanup.
5. Provide commands to run the application.
6. Include a checklist for visually verifying the island.
7. Identify what Chat 08 should implement.

The result should be a polished, stable, fixed-perspective island viewport.
