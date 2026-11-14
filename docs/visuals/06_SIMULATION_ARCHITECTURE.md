
# Project Genesis — Simulation Architecture

Read `PROJECT_OVERVIEW.md` before doing anything else.

## Objective

Establish the architecture and React layout for the Simulation screen.

This task is exclusively about building the structural foundation. Do not implement the island renderer, simulation mechanics, organisms, or functional graphing yet.

The result should be a functional React screen with a correctly organized layout and a clearly defined Three.js viewport component.

## Context

Project Genesis is an artificial-life simulation intended to explore whether intelligence can emerge naturally through evolution.

The application uses:
- React
- TypeScript
- Vite
- Three.js

The application already has a landing/opening screen and an existing terrain renderer or terrain integration from earlier work.

Inspect the existing code before proposing changes. Reuse the existing architecture rather than replacing it.

## Simulation Workspace Design

The Simulation screen should resemble a simplified Unity Editor or scientific simulation environment.

It consists of three primary regions:

### A. Simulation Header

A narrow header at the top of the simulation workspace.

The upper-left should eventually display simulation time and date.

Other simulation controls may eventually appear elsewhere, but do not implement them now.

### B. Main Viewport

The dominant portion of the screen.

It contains the Three.js island environment.

It must occupy substantially more screen space than the inspector panels.

The viewport should have a clearly defined boundary separating the 3D environment from the interface.

### C. Right Sidebar

A vertically arranged sidebar containing two panels:

- Individual Inspector
- Population Overview

The Individual Inspector occupies the upper portion.

The Population Overview occupies the lower portion.

The panels should have a clear visual separation and their own headers.

Do not invent organism data or population values.

## Layout Requirements

Use CSS Grid or another appropriate layout system.

Recommended conceptual layout:

- Header: full width.
- Main viewport: approximately 70–80% of the remaining width.
- Sidebar: approximately 20–30%.
- Sidebar: two vertically stacked panels.
- Main viewport and sidebar should fill the available vertical space.

Avoid hardcoding dimensions that break on smaller screens.

The simulation interface should fill the browser viewport without unnecessary page scrolling.

The landing screen and simulation screen must remain separate React states/components.

## Architecture Requirements

Create a clear separation between:

- Simulation page/layout
- Three.js viewport
- Simulation HUD
- Inspector panel
- Population graph panel

The Three.js viewport must not be implemented directly inside the sidebar or general interface components.

The simulation screen should be capable of hosting a persistent Three.js scene.

Avoid:
- Multiple animation loops
- Multiple renderers for the same viewport
- Unnecessary scene recreation
- Global mutable state without justification
- Unnecessary dependencies

## Placeholder Components

Create lightweight placeholder components for:

- Simulation clock
- Individual inspector
- Population graph

These should establish the correct component boundaries and visual structure.

They should not contain invented simulation data.

## Scope Restrictions

Do not:
- Render organisms.
- Implement the simulation.
- Connect Kotlin simulation logic.
- Advance simulation time.
- Implement graph data.
- Implement inspector selection.
- Implement simulation controls.

## Deliverables

1. Explain the architecture and component hierarchy.
2. Provide a proposed directory tree.
3. Provide complete contents of all new and modified files.
4. Explain how the Simulation screen is entered from the existing opening screen.
5. Explain how the Three.js viewport will be mounted and cleaned up.
6. Provide exact commands to run and verify the application.
7. Provide a short handoff explaining what Chat 07 should implement.

Do not leave critical components as unexplained pseudocode.
