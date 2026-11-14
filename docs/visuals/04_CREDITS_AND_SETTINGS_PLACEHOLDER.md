
# Chat 4 — Credits and Settings Navigation Placeholder

Read `PROJECT_OVERVIEW.md` and inspect the current application, Landing, Opening, and transition implementation. Preserve the established architecture.

## Goal

Complete the Credits UI and ensure Settings navigation is represented without implementing Settings itself.

## Credits content (exact)

- **Landen Ingerslev (Calcium King)**
- **Pete (Seal Ball Pete)**
- **Created for the 14th annual UMass Hackathon**

Do not invent additional contributors, affiliations, roles, or acknowledgments.

## Credits presentation

Use the visual language of the existing game menu. Credits should be a distinct interface section, not a new URL or browser page.

Choose the simplest presentation consistent with the existing design (a separate screen or modal/overlay). Explain the choice briefly. Provide an obvious way to return to Opening and ensure keyboard/accessibility behavior is sensible.

## Settings

Settings are intentionally deferred to a later, separate conversation with the project owner.

- Keep the Settings button/navigation affordance in Opening.
- It may be disabled or lead to a minimal clearly labeled placeholder.
- Do not create settings options, controls, persistence, configuration logic, or a full Settings screen.
- Leave a clean integration point for a future Settings component.

## Constraints

- No URL changes or reloads.
- Do not replace/reinitialize the terrain scene during Credits navigation.
- Do not implement simulation gameplay, organisms, or animals.

## Deliverable

Give exact paths and complete file contents for every change. Explain how Credits is opened/closed and how Settings is deliberately deferred. End with run/test steps and a handoff note for Chat 5.
