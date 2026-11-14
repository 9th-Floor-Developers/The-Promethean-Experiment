
# Chat 1 — Project Setup and Application Shell

Read `PROJECT_OVERVIEW.md` first. This is a completely new project; I will manually create files from your response in Claude Web.

## Goal

Establish the React + TypeScript + Vite + Three.js project foundation and a minimal persistent application shell. Do not build the detailed terrain or finished menu yet.

## Requirements

1. Recommend the exact project creation commands and dependency installation commands.
2. Propose a clean, modest folder structure that supports:
    - A persistent Three.js background/scene.
    - Screen UI components (Landing, Opening, Credits).
    - Shared styles/design tokens.
    - A future terrain-data adapter based on Kotlin reference files.
    - Future Settings and Simulation screens without implementing them now.
3. Define the architecture and interfaces that later chats must follow:
    - How the Three.js scene is mounted, initialized, resized, and disposed.
    - How screen state is represented and changed.
    - How the terrain renderer receives terrain data.
    - How UI components coexist over the Three.js canvas.
4. Create the minimal application shell and global styles needed to run.
5. Use TypeScript strictly and avoid unnecessary dependencies.
6. Keep the URL unchanged; no router is needed for the requested screens.
7. Explain exactly where every file goes and provide complete contents for each file.

## Scope boundaries

- Do not implement the final terrain geometry.
- Do not implement the finished Landing or Opening UI.
- Do not implement Settings or simulation gameplay.
- You may create placeholder components/interfaces that later chats can replace or complete.

## Deliverable format

Start with:
- Architecture overview.
- Folder tree.
- Commands.

Then provide each file as a separate labeled code block with its exact path. End with a short manual setup/run checklist and a handoff note for Chat 2.
