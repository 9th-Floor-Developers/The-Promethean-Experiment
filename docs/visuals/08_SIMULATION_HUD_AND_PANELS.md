
# Project Genesis — Simulation HUD and Panels

Read:
- PROJECT_OVERVIEW.md
- 06_SIMULATION_ARCHITECTURE.md
- 07_ISLAND_VIEWPORT_AND_CAMERA.md

Inspect the existing implementation before making changes.

## Objective

Implement the visual interface surrounding the simulation viewport.

This task establishes the simulation header, individual inspector, and population overview.

Do not connect Kotlin simulation logic or invent actual simulation data.

## 1. Simulation Clock

The upper-left corner of the simulation screen should display the simulation date and time.

The clock represents the simulated world, NOT the computer's real clock.

For now:
- Create a clearly defined simulation clock component.
- Use a placeholder initial simulation date/time.
- Make the display easy to connect to a future simulation clock.
- Do not advance time automatically.
- Do not use Date.now() as the simulation time.

The eventual clock should support a simulation date and a time-of-day.

Keep the display compact and technical.

## 2. Individual Inspector

The upper-right panel should be an individual organism inspector.

Eventually, the user will click an organism in the viewport and see its statistics here.

For now:
- Create the panel and its header.
- Create a clear empty/placeholder state.
- Indicate that no organism is currently selected.
- Do not invent organism properties.
- Do not implement selection.
- Do not create fake organisms.

The future implementation will inspect Kotlin organism definitions and determine which properties are meaningful.

Keep the panel extensible for:
- Organism identity
- Biological characteristics
- Neural or behavioral information
- Other properties supported by the actual simulation

Do not hardcode these categories as actual data fields yet.

## 3. Population Overview

Below the individual inspector should be a population overview panel.

Eventually, this panel will contain a population-versus-time graph.

For now:
- Create the panel header.
- Create a placeholder chart area.
- Label the intended graph clearly.
- Do not generate fake data.
- Do not implement graph calculations.
- Do not connect simulation state.

The panel should be visually distinct from the inspector.

## 4. Visual Style

The interface should feel like a scientific simulation editor.

Use:
- Dark interface surfaces.
- Subtle borders.
- Muted secondary text.
- Clear panel titles.
- Small technical labels where appropriate.
- Consistent spacing.
- A restrained monochrome interface around the colorful island.

The island should remain the primary visual focus.

Avoid excessive decorative elements, unnecessary icons, or large amounts of text.

## 5. Layout Behavior

The header should remain readable without obstructing the viewport.

The right sidebar should:
- Keep the inspector above the population graph.
- Allocate enough space to both panels.
- Avoid excessive scrolling.
- Remain visually separate from the viewport.

The graph area should eventually be large enough to display useful historical population data.

## Scope Restrictions

Do not implement:
- Actual simulation time advancement.
- Simulation speed controls.
- Pause or reset.
- Organism selection.
- Actual organism properties.
- Live population counts.
- Population history.
- Real graph data.

## Deliverables

1. Provide complete contents of all new and modified files.
2. Explain the clock interface and future integration point.
3. Explain the inspector's placeholder state.
4. Explain the population graph placeholder.
5. Verify the interface visually with the island viewport.
6. Provide commands and a short test checklist.
7. Identify what Chat 09 should implement.

Do not modify the terrain renderer unnecessarily.
