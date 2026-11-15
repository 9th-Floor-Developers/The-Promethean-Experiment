
# Chat 3 — Landing Screen, Opening Menu, and Camera Transition

Read `PROJECT_OVERVIEW.md` and inspect the existing application shell and terrain renderer. Preserve their architecture.

## Goal

Implement the landing and opening/menu interfaces over the persistent Three.js terrain.

## Landing screen

- Display the project title: **The Promethean Experiment**.
- Display a clear click-to-start prompt.
- Clicking anywhere within the landing screen transitions to the Opening screen.
- Make the interaction accessible: keyboard activation and appropriate focus behavior must also work.
- Avoid accidental clicks on unrelated UI controls if any are present.

## Opening screen

- Project title in the upper-left.
- A **Start Simulation** button.
- A **Settings** button.
- A **Credits** control/section.
- Keep the interface simple, game-like, and visually balanced over the terrain.

## Transition

- Landing → Opening must not change the URL or reload the page.
- Keep the same Three.js scene and terrain instance.
- Visually transition with a subtle camera zoom toward the miniature island. The interface changes while the background remains continuous.
- Coordinate camera animation with React screen state without creating competing animation loops.
- Respect reduced-motion preferences; provide a reduced or instant transition when requested.
- Do not overcomplicate this with a routing library.

## Scope boundaries

- Start Simulation is a UI-only action for now. It must not start a real simulation; leave a clear TODO or harmless placeholder behavior.
- Settings is navigation only: do not implement settings controls or preferences.
- Credits may be wired to a placeholder component/control, but detailed credits implementation belongs to Chat 4.
- Do not add organisms, animals, neural networks, or gameplay.

## Visual direction

The terrain is colorful, cute, and low-poly. The UI should feel like a modern game's title/menu screen:
- Strong hierarchy.
- Legible contrast.
- Minimal, deliberate motion.
- No generic admin dashboard aesthetic.
- Responsive layout.

## Deliverable

Provide:
- Exact files to create/change and their locations.
- Complete contents for each file.
- Any integration steps with the scene/camera API.
- Run/test instructions.
- A handoff note for Chat 4.
