
# Chat 5 — Integration, Testing, and Final Polish

Read `PROJECT_OVERVIEW.md` and inspect the files/implementation produced by the previous chats. I will provide the relevant code or file tree.

## Goal

Integrate and polish the existing The Prometheus Experiment menu experience. Do not rewrite working components unnecessarily.

## Verify the complete flow

1. App loads at one URL with the terrain visible.
2. Landing displays The Prometheus Experiment and click-to-start.
3. Clicking anywhere in Landing transitions to Opening.
4. The background remains the same terrain/scene, with a subtle zoom transition.
5. Opening displays the title at top-left and Start Simulation, Settings, and Credits controls.
6. Start Simulation is functional as a UI action but does not implement gameplay.
7. Settings remains intentionally unimplemented and clearly deferred.
8. Credits displays exactly:
    - Landen Ingerslev (Calcium King)
    - Pete (Seal Ball Pete)
    - Created for the 14th annual UMass Hackathon
9. Credits can be exited back to Opening.
10. All sections stay on the same URL without reloads.
11. Canvas resizing, cleanup, and navigation do not create duplicate Three.js render loops or leaked resources.
12. UI works at desktop and smaller viewport sizes, and reduced-motion behavior is respected.

## Polish

- Fix integration/type errors and inconsistent interfaces.
- Check layering, pointer events, click handling, text contrast, and camera framing.
- Ensure the menu does not unintentionally block or trigger Landing interactions.
- Keep animations coordinated and avoid unnecessary dependencies.
- Preserve the established terrain appearance and architecture.

## Scope boundaries

Do not implement Settings, organisms, neural networks, evolution, or simulation gameplay. Do not add new pages or features beyond what is needed to complete and polish the specified menu experience.

## Deliverable

- Report issues found and the fixes.
- List exact files changed and provide complete contents for each changed file.
- Give commands for type-checking/building/running.
- Provide a concise final manual QA checklist.
- Clearly identify remaining placeholders and TODOs.
