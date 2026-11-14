
# Project Genesis — Viewport Interaction Foundation

Read:
- PROJECT_OVERVIEW.md
- 06_SIMULATION_ARCHITECTURE.md
- 07_ISLAND_VIEWPORT_AND_CAMERA.md
- 08_SIMULATION_HUD_AND_PANELS.md

Inspect the existing implementation before making changes.

## Objective

Prepare the simulation viewport for future interaction with organisms and the environment.

This task is about interaction architecture and viewport behavior, NOT simulation mechanics.

## Camera Philosophy

The Simulation View is a fixed observational environment.

The island must not rotate automatically.

Do not introduce:
- Automatic orbiting.
- Automatic camera rotation.
- Cinematic camera movement.
- Continuous camera animations.
- Camera paths.

The user should feel like they are observing a world, not viewing a rotating model.

## Viewport Interaction

Establish a clean interaction foundation that future work can extend.

The viewport should support the possibility of:
- Selecting organisms.
- Identifying clickable objects.
- Receiving pointer input.
- Distinguishing interaction from camera movement.

For this stage:
- Do not implement actual organism selection.
- Do not create fake organisms.
- Do not invent organism data.
- Do not implement environmental interactions.

If useful, create an interaction interface or event boundary that future rendering components can extend.

Avoid introducing an unnecessarily complicated interaction framework.

## Camera Controls

If camera interaction is implemented, it should be restrained.

Appropriate possibilities:
- Limited zoom.
- Optional panning.
- A reset-view action.

Avoid uncontrolled free-orbit behavior.

Do not add controls merely because they are common in 3D applications.

The default camera must remain fixed and stable.

## Input Handling

Ensure that:
- React UI interactions do not accidentally trigger viewport input.
- Pointer events are handled in the correct component.
- Future selection events can be passed to the inspector.
- The viewport can receive interaction without the entire page rerendering.

Do not implement keyboard shortcuts or extensive controls unless they are genuinely useful at this stage.

## Scope Restrictions

Do not implement:
- Organism selection.
- Organism rendering.
- Organism movement.
- Simulation mechanics.
- Neural networks.
- Evolution.
- Kotlin integration.

## Deliverables

1. Explain the viewport interaction architecture.
2. Provide complete contents of changed/new files.
3. Explain how future organism selection will connect to the inspector.
4. Explain camera interaction behavior, if implemented.
5. Verify that UI controls and viewport input do not conflict.
6. Provide commands and a test checklist.
7. Identify what Chat 10 should implement.

Prioritize simplicity and extensibility.
