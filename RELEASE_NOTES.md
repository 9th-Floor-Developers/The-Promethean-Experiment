# v1.0.0 — The Promethean Experiment

First public release. An evolution sandbox built to ask one question: **is intelligence an inevitable outcome of evolution?**

Species are defined by traits, animals inherit and mutate their stats, and some of them think with a neural network they train while resting. The simulation runs in 2D (Kotlin, compiled to WebAssembly) and is rendered in low-poly 3D in the browser (three.js + React + TypeScript).

> Built for UMAHack.

## Highlights

- 🧠 **Soft-coded brains** — `SOFT_CODED` species are driven by a per-animal Q-learning neural network, not by scripted rules. Brains are mostly *learned*, not inherited, and animals also learn by watching their own species.
- 🧬 **Inherited stats and mutation** — newborns mix their parents' HP, speed, damage, armor and view range, with a per-species mutation rate (0–50%).
- 🦓 **Traits make the species** — 6 trait categories plus 9 freely combinable traits (sprinting, venom, poison, spikes, hard skin, regeneration, alarm calling, night vision, hearing).
- 🌍 **Living world** — Perlin-noise terrain (fresh water, plain, forest, desert), growing grass and trees, carcasses that rot, eggs that hatch, and a full day–night cycle that changes what animals can see.
- 📊 **Instrumentation that answers the question** — live population graph, trait radar with an intelligence axis, age-of-death histogram, cause-of-death charts, and deaths per 100 animal-days per species.
- 🎮 **Four built-in presets** — Default, Paradise, Savanna and Learning lab, plus your own saved presets.

## What's included

### Simulation core (Kotlin → WebAssembly)

- **Animals** with HP, stamina, nutrition, hydration and age. Running out of food or water does damage; HP regenerates when stamina is nearly full; stamina regeneration falls off with age.
- **Actions**: rest, wander, explore, run from predator, attack target, drink water, eat food, reproduce with.
- **Hard-coded AI** driven by four feelings — fear, hunger, thirst, libido.
- **Soft-coded AI**: 14 world inputs → inherited hidden layers → one drive per need (flee, eat, drink, mate, rest, explore). The strongest drive wins, with 10% random exploration. Rewards come from need wellbeing, HP change and offspring; every tick spent resting replays 16 remembered decisions (30% of them observed from others). Every hidden neuron costs stamina, so a bigger brain has to earn its keep.
- **Sound**: alarm calls and sprints emit expanding rings; only `HEARING` species pick them up. A call carries 1.5× view range, a sprint 1.0×, a walk 0.25× — moving about is nearly silent, a deliberate call is the loudest thing in the world. Sound is not dimmed by darkness, so hearing counts for more at night.
- **Sim objects**: trees (forest tiles), grass (plain tiles), carcasses (rot over 3 days), eggs (hatch after a cooldown, and can be eaten).
- **Performance**: spatial grid for nearby lookups, distance fields and a pathfinder for movement.

### Interface

- Landing → opening (spinning preview of the active preset's species) → simulation, plus a credits screen.
- **Viewport**: click any animal, tree, grass tuft, carcass or egg to inspect it; view-range overlay draped on the terrain; route drawn as arrows coloured by action; camera lock to follow an animal.
- **Inspector**: every inherited and calculated stat, intelligence, and a drawing of the animal's neural network.
- **Leaderboard** with live animal portraits, top 10.
- **Statistics page**, live or at the end of a run: population history, trait radar against the founder shape, age-of-death histogram per species, cause-of-death pie, natural-share line, death rates.
- **Title effects** for extinctions, population milestones and each new day.
- **Settings**: Species (stats, counts, traits, mutation rate), World (map size, water, trees, grass) and Display (always show daytime) tabs; presets can be created, duplicated, renamed, deleted and reset.
- Simulation speed in steps of 1×, 2×, 5×, 10×, 20×, with an end-simulation button.

### Visuals

- Low-poly, colourful, family-friendly art, all generated locally — no external models.
- Every species gets its own random fictional look, stable across day and night.
- Day–night cycle driving sky, fog and light colour, with a sun/moon icon beside the clock.
- One GPU-instanced draw call per species.

## Getting started

Requires Node.js 20+ and a JDK 17+ (the Gradle wrapper is included).

```bash
npm install
npm run dev     # builds the Kotlin/Wasm simulation, then serves the frontend
npm run build   # production build
```

The headless JVM runner (`./gradlew jvmRun`) runs the simulation without a browser, which is how the presets were tuned.

## Known limitations

- Fleeing is not learned by soft-coded brains yet: animals caught by a predator rarely survive to rest and learn from it.
- The Savanna preset is not stable on every seed — hyenas and tortoises can still die out.
- Browser-only frontend; no save/load of a running simulation.

## Documentation

Design docs live in `docs/`: `docs/sim/SPECIES.md` (stats and traits), `docs/sim/ANIMALS.MD` (status values, actions and both AI systems), `docs/sim/SIM_OBJECT.MD` (world objects), and `docs/visuals/` (visual and UI design). `ENDGOAL.MD` is the one-page project goal.

**Full Changelog**: https://github.com/9th-Floor-Developers/The-Promethean-Experiment/commits/v1.0.0
