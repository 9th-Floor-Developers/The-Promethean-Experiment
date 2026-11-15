/**
 * Plain-language explanations shown as tooltips around the app.
 *
 * One place for every "what does this number mean?" answer, so the inspector, the leaderboard and the
 * settings screen all explain the same thing the same way. Wording follows docs/sim/ANIMALS.MD and
 * docs/sim/SPECIES.md; keep them in step when the simulation changes.
 */

/** Live status values of an animal: the inspector's meters, feelings and trait-specific rows. */
export const STATUS_HELP = {
    hp: 'Health left. The animal dies when this reaches 0. It only heals back while its stamina is above 90% full.',
    stamina: 'Energy. Spent by living and moving, refilled slowly by resting. The emptier it is the slower the animal walks, and older animals refill it more slowly.',
    sprint: 'Trait SPRINTING: the sprint reserve, in ticks of sprinting left. Sprinting is twice the speed for three times the stamina; the reserve refills while the animal is not sprinting.',
    nutrition: 'Food in its body. It drops as the animal spends stamina and refills by eating. At 0 the animal starts losing health.',
    hydration: 'Water in its body. It drops as the animal spends stamina and refills by drinking. At 0 the animal starts losing health.',
    age: 'How long the animal has lived, in in-game days (1 day = 1200 ticks).',
    action: 'What the animal is doing right now. It picks a new action when the old one ends or becomes impossible, or when a predator comes into view.',
    calling: 'Trait ALARM_CALLING: whether it is shouting a warning right now. An animal fleeing a predator it can see calls for 15 ticks, then stays quiet for 90, so it calls in short bursts.',
    earshot: 'Trait HEARING: how far an alarm call reaches this animal (1.5x its eyesight). A sprinting animal is heard at 1x that eyesight and a walking one at 0.25x.',
    toxin: 'Venom or poison still working in its body. It keeps taking damage until this runs out.',
    fear: 'How scared it is of the nearest predator it can sense: 0 means none is near, 1 means terrified.',
    hunger: 'How badly it wants food: 0 when its nutrition is full, 1 when it is starving.',
    thirst: 'How badly it wants water: 0 when its hydration is full, 1 when it is parched.',
    libido: 'How much it wants to breed: 0 when it is not ready or still on a cooldown after breeding, 1 when it is fully fed and looking for a mate.',
    /** Added to the four feelings for a neural-network animal, whose feelings come out of the network instead. */
    softCodedFeelings: ' For a neural-network animal this is the share the network gives that drive.',
} as const;

/** Stats calculated from the inherited ones (docs/sim/SPECIES.md), shown in the inspector. */
export const CALCULATED_HELP = {
    baseStaminaUsage: 'Stamina spent every tick simply by being alive. It rises with max health and with eyesight, so a big, sharp-eyed animal tires faster even standing still.',
    walkingStaminaUsage: 'Extra stamina spent each tick while moving, on top of the base cost. It rises with speed.',
    elderlyAge: 'The age at which it counts as elderly. From then on its stamina refills more slowly the longer it has been old. Better eyesight brings this age forward.',
    intelligence: 'Hidden neurons in its neural network (trait SOFT_CODED). Every hidden neuron costs stamina each tick, so a bigger brain has to earn its keep. Instinct animals have no network.',
    inherited: 'Inherited stats are mixed from both parents at birth and nudged by the species mutation rate; they never change during a life.',
    network: 'The animal’s brain: senses on the left, drives on the right, one dot per neuron. Blue lines are positive connections, orange negative, and brighter lines are stronger. The glowing drive is what it wants most right now.',
} as const;

/** Rows shown for a selected tree, grass tuft, carcass or egg. */
export const OBJECT_HELP = {
    state: 'Whether there is anything to eat here right now. An eaten plant has to regrow first.',
    regrowth: 'How far this plant has regrown since it was last eaten. It can be eaten again when the bar is full.',
    cooldownLeft: 'Time until this plant can be eaten again.',
    cooldownFull: 'How long this plant takes to regrow after being eaten.',
    nutrition: 'How much nutrition an animal gains by eating this.',
    meat: 'Meat left on the carcass. Each meat eater that feeds takes a share, and the rest rots away.',
    rot: 'Time until the carcass rots away completely and disappears.',
    hatching: 'How far along the egg is. The baby hatches when the bar is full.',
    eggSpecies: 'The species the egg will hatch into.',
    position: 'Where it is on the island, in tiles.',
} as const;

/** Actions an animal can be doing (ACTION_NAMES in SimulationExport.kt). */
export const ACTION_HELP: Record<string, string> = {
    REST: 'Standing still to get stamina back. Neural-network animals also do their learning while resting.',
    WANDER: 'Drifting about nearby with nothing in particular to do.',
    EXPLORE: 'Striking out for somewhere far from where it is now.',
    RUN_FROM_PREDATOR: 'Running away from a predator it can see or hear.',
    ATTACK_TARGET: 'Biting another animal. It deals its bite strength in damage each tick it keeps biting.',
    DRINK_WATER: 'Heading for water, or drinking at the edge of it.',
    EAT_FOOD: 'Heading for food, or eating it.',
    REPRODUCE_WITH: 'Pairing up with a well-fed mate of its own species to make a baby.',
};

/** The leaderboard's controls and the stats it can rank by. */
export const LEADERBOARD_HELP = {
    rankBy: 'Which value the animals are ranked by. Every species has all of them, so the ranking works for any mix of species.',
    show: 'Narrow the ranking to one species, or to all the plant eaters or all the meat eaters.',
    order: 'Swap between the highest and the lowest values first.',
    row: 'Click an animal to follow it in the inspector.',
} as const;

/** Short explanations of the brain inputs, in the order of BRAIN_INPUTS. */
export const BRAIN_INPUT_HELP: string[] = [
    'How much health it has left, as a share of its maximum.',
    'How full its nutrition is.',
    'How full its hydration is.',
    'How much stamina it has left.',
    'How old it is compared with the age it turns elderly.',
    'How ready it is to breed.',
    'How close the nearest predator is (0 when none is in range).',
    'How close the nearest food is.',
    'How close the nearest water is.',
    'How close the nearest possible mate is.',
    'Time of day as a smooth wave, so the network can tell night from day.',
    'The other half of the time-of-day wave.',
    'Whether its activity cycle says it should be awake now.',
    'How much venom or poison is working in its body, so it can learn to avoid the species that left it.',
    'Trait HEARING: how loudly it hears the animal that matters most to it. Loudness only, never direction.',
];

/** Short explanations of the brain outputs (the drives), in the order of BRAIN_OUTPUTS. */
export const BRAIN_OUTPUT_HELP: string[] = [
    'Run away from the nearest danger.',
    'Go and eat.',
    'Go and drink.',
    'Go and find a mate.',
    'Stand still, recover stamina and learn.',
    'Head somewhere new.',
];

/** Headings on the statistics page. */
export const CHART_HELP = {
    population: 'How many animals of each species are alive over time. The dashed line is the total.',
    populationLive: 'Living animals of each species over the last few in-game days. Expand for the whole run.',
    radar: 'The average body stats of one species compared with the stats it started with, so you can see which way evolution has pushed it.',
    deathAges: 'How old animals were when they died, so you can see whether most die young or live out a full life.',
    deathCause: 'Whether animals are dying to predators or to natural causes such as starvation and thirst, for the whole run and over time.',
    deathRate: 'Deaths from hunger or thirst per 100 animal-days, which counts per animal rather than per population: a falling line means each animal is coping better.',
} as const;

/** Controls in the simulation header. */
export const HEADER_HELP = {
    back: 'Stop the simulation and go back to the menu. The run is discarded.',
    end: 'Finish the run now, exactly as if every animal had died, and show the statistics page.',
    speed: 'How many simulation ticks are run per frame (1x, 2x, 5x, 10x, 20x). Higher speeds may slow the drawing down.',
    clock: 'The in-game day and time. One day lasts 1200 ticks, and animals with a daily schedule live by this clock.',
    expand: 'Open the statistics page for the whole run. The simulation keeps running behind it.',
} as const;

/** Controls on the settings screen that have no help text of their own. */
export const SETTINGS_HELP = {
    preset: 'A saved set of species and world settings. The chosen preset is the one Start Simulation runs.',
    presetName: 'Rename this preset. Names are only for you; they do not change the simulation.',
    newPreset: 'Start a new preset from the default species.',
    duplicate: 'Copy this preset, so you can change the copy and keep the original.',
    deletePreset: 'Delete this preset for good. You cannot delete your last one.',
    speciesName: 'What this species is called in the inspector, the leaderboard and the graphs.',
    startingAnimals: 'How many animals of this species the island starts with.',
    removeSpecies: 'Remove this species from the preset.',
    newLook: 'Roll a new random appearance for this species. Looks never affect behaviour.',
    tabSpecies: 'Design the species: their bodies, their traits and how many start on the island.',
    tabWorld: 'Set the size of the island and how much food and water it has.',
    tabDisplay: 'Viewing comfort options. These apply to every preset and take effect right away.',
    done: 'Go back to the menu. Everything here is saved as you change it.',
} as const;
