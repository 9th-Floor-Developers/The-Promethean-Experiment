
# The Promethean Experiment — Shared Project Brief

This document is the shared source of truth for every Claude conversation working on this project. Read it before the task-specific prompt.

## Project

**The Promethean Experiment** is a hackathon artificial-life / evolutionary simulation. The eventual simulation will contain organisms and evolutionary mechanics, but those are explicitly out of scope for the current implementation.

This is a completely new project. The developer is using Claude Web and will manually copy generated files into the repository. Claude must not assume it can directly edit the local filesystem.

## Current implementation scope

Build only:
- A persistent React application shell.
- A Three.js 3D background containing a colorful, cute, low-poly miniature island/world.
- A landing screen with the project title and a click-to-start affordance.
- An opening/main-menu screen with a Start Simulation button, Settings navigation affordance, and Credits.
- Screen transitions that change interface state without changing the URL or reloading the page.
- A clean architecture that allows terrain data, settings, and simulation functionality to be added later.

Do **not** implement organisms, animals, neural networks, evolution, ecology, simulation ticks, or simulation gameplay. The Start Simulation button should be functional as a UI control but intentionally have no simulation implementation yet (it may show a clearly marked placeholder or remain a no-op with an appropriate TODO).

## Technology

Use:
- React
- TypeScript
- Three.js
- Vite

Use idiomatic React and TypeScript. Keep the Three.js scene lifecycle separate from UI state. Avoid unnecessary libraries; explain and justify any additional dependency before introducing it.

## Terrain source

The developer will provide Kotlin files containing:
- A terrain types enum.
- A terrain object/model.

Treat those Kotlin files as the authoritative description of terrain semantics and data. They are references, not code to execute in the browser. Before implementing the terrain adapter, inspect the provided files and explain how their concepts map to TypeScript.

Do not invent a conflicting terrain schema. If the Kotlin files do not specify enough information for rendering, ask a focused question or propose a minimal adapter that preserves their semantics.

The terrain is a 2D dataset rendered in 3D for presentation. The visual target is a **colorful, cute, low-poly miniature island/world** with visible island boundaries and stylized elevation. There are no animals or organisms yet.

## Experience and navigation

All sections must remain on the same URL. Use React state or an equivalent client-side view-state mechanism; do not navigate to separate routes for these screens and do not reload the page.

The intended screens:
1. **Landing** — project title and click-to-start prompt. Clicking anywhere in the landing screen transitions to Opening.
2. **Opening** — title in the upper-left; Start Simulation button; Settings button; Credits section/control.
3. **Settings** — deliberately not implemented in this phase. The navigation affordance may be a disabled placeholder or a minimal clearly marked stub; do not design or build actual settings.
4. **Credits** — display:
    - Landen Ingerslev (Calcium King)
    - Pete (Seal Ball Pete)
    - Created for the 14th annual UMass Hackathon

The terrain/background persists between Landing and Opening. The transition should feel like a slight camera zoom into the same miniature world, not a scene replacement or page reload. Keep the same terrain/scene instance when practical.

## Visual direction

- Game-inspired, clean, immersive menu.
- Terrain is colorful and low-poly; UI should be readable and intentional.
- Do not let the UI overwhelm the world.
- Avoid excessive visual effects, clutter, or generic dashboard styling.
- Design responsively for desktop first, but make controls usable on smaller screens.
- Use accessible button semantics, keyboard support, and sensible focus behavior.

## Working with Claude Web

For every task:
- Start by summarizing the intended implementation and file plan.
- Tell the developer exactly where each file should be created.
- Provide complete file contents, not fragments or unexplained diffs.
- State commands to install dependencies and run/check the project when relevant.
- Keep a list of files created or changed.
- Do not silently change architecture or files owned by another task.
- If a prerequisite is missing, ask before inventing an incompatible implementation.
- Prefer small, well-separated components and explicit interfaces.
