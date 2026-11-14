
# Project Genesis — Simulation View Integration and Polish

Read:
- PROJECT_OVERVIEW.md
- 06_SIMULATION_ARCHITECTURE.md
- 07_ISLAND_VIEWPORT_AND_CAMERA.md
- 08_SIMULATION_HUD_AND_PANELS.md
- 09_VIEWPORT_INTERACTION_FOUNDATION.md

Inspect the entire existing project before making changes.

## Objective

Integrate and polish the Simulation View.

The goal is to produce a coherent simulation workspace that feels like a real artificial-life simulation application.

This is an integration and visual refinement task, not a simulation implementation task.

## Overall Layout

The final interface should contain:

### Header
- Simulation date and time in the upper-left.
- A compact technical interface.
- No unnecessary navigation or decorative elements.

### Main Viewport
- The island occupies most of the screen.
- The camera is fixed and observational.
- The island does not automatically rotate.
- The terrain remains colorful and low-poly.
- The viewport is clearly separated from the interface.

### Right Sidebar
- Individual Inspector above.
- Population Overview below.
- Both panels remain visible and readable.
- The sidebar should not compete visually with the island.

## Visual Refinement

Review the interface as a complete application.

Check:
- Panel proportions.
- Viewport dimensions.
- Spacing and alignment.
- Typography.
- Border consistency.
- Contrast.
- Color balance.
- Visual hierarchy.
- Responsiveness.
- Empty states.

The interface should feel technical and deliberate, not like a collection of unrelated cards.

## Rendering Stability

Verify:
- One renderer per viewport.
- No duplicated animation loops.
- No unnecessary scene recreation.
- Proper resource cleanup.
- Correct resize behavior.
- No WebGL canvas overflow.
- No React rendering issues.
- No memory leaks from repeated screen transitions.

## Navigation

Verify the existing opening screen can enter the Simulation View.

The transition must:
- Remain within the same URL.
- Avoid unnecessary page reloads.
- Preserve the intended application state.
- Properly mount and unmount the simulation interface.

## Responsive Behavior

The simulation is primarily a desktop application.

Still ensure:
- The viewport does not overflow the browser.
- Panels do not overlap unexpectedly.
- Smaller screens have a reasonable fallback layout.
- Text remains readable.
- The application does not introduce unnecessary scrolling.

Do not compromise the desktop simulation layout merely to make it resemble a mobile application.

## Scope Restrictions

Do not implement:
- Simulation mechanics.
- Organisms.
- Evolution.
- Neural networks.
- Kotlin simulation integration.
- Functional organism inspection.
- Functional population graph.
- Simulation controls.

Those belong to subsequent development stages.

## Deliverables

1. Provide a summary of the final architecture.
2. Provide complete contents of every modified file.
3. Explain any integration fixes.
4. Provide commands to run the application.
5. Provide a complete verification checklist.
6. Identify the interfaces future simulation implementation should use.
7. Identify any remaining placeholders and explain how they will eventually be connected.

Do not rewrite functioning components simply to achieve stylistic consistency.

Preserve working functionality and make targeted improvements.
