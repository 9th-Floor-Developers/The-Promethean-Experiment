SPECIES UNIVERSAL STATS
these are stats for every species that constant during a life of the animal

when the simulation starts these stats will be of 'initial stats' which is set by the player

These are inherited stats, When an animal spawns it mixes the stats of it parents and a random mutation
MAX HP(DEF: 100, MIN: 1)
SPEED (DEF: 0.1, MIN: 0.01)
DAMAGE (DEF: 3, MIN: 0.1) 
ARMOR (DEF: 1, MIN: 0.1)
VIEW_RANGE - animals can only see things this distance in tiles (DEF: 10, MIN 3)

MUTATION RATE (DEF: 5%, 0% to 50%) - a species setting (set in Settings or a preset), not an inherited stat: it is never inherited or mutated itself
each inherited stat of a newborn changes by up to this percent either way, and SOFT CODED brain mutations scale with it (0% = exact copy of the parents)

These are calculated stats calculated from the inherited stats
BASE_STAMINA_USAGE - increase when MAX HP increases and VIEW RANGE increases
WALKING_STAMINA_USAGE - increase when SPEED increases
ELDERLY - decreases when VIEW RANGE increases

SPECIES TRAITS

CONTROLLER

HARD CODED - Uses hard coded system to control the animals action
SOFT CODED - Uses a neural network to control the animals action

This is the animal AI system which will be described more in ANIMAL_AI.MD




CONSUMPTION

CARNIVORE - Eats other animals.
HERBIVORE - Eats plants.
OMNIVORE - Eats both plants and animals.
SCAVENGER - Feeds on dead animals does not attack animals.


BIRTHING

LIVE BIRTH - Offspring develop inside the parent and are born alive.
EGG BIRTH - Offspring dev1. Celop inside an egg outside the parent.

BODY COVERING
Every covering trades defence against upkeep, so none of them is strictly best: whatever takes the sting out of a bite costs its owner water, food, stamina or speed to carry around. A covering's defence is a percentage of each bite, added to the ARMOR stat and capped together with it; a rigid covering also takes a flat amount off the top, the way HARD SKIN does, and a bite still always lands at least a tenth of its damage. A species may have no covering at all, which costs and gives nothing.

FUR - Has a coat of hair or fur: takes 4% more off every bite, and dries its owner out a quarter faster at every hour of the day, since the coat is carried through the heat as well as the cool.
FEATHERS - Has feathers covering some or all of its body: takes 2% more off every bite and costs 15% less stamina to carry about, but insulates like fur and so drinks 15% more. The mover's covering - it travels furthest on the least energy and pays for it at the water's edge.
SCALES - Has scales covering its body: takes 8% more off every bite and seals moisture in, drinking only 72% as fast, but is stiff and heavy enough to travel 7% slower. The drought specialist that cannot outrun its troubles.
EXOSKELETON - Has a hard external skeleton: takes 14% off every bite and a flat amount on top of that, so a small bite barely tells, but the plate costs 18% more stamina to haul about at every moment.
BARE SKIN - Has exposed skin without a substantial external covering.
SHELL - Has a hard protective shell.


ACTIVITY CYCLE

DIURNAL - Primarily active during the day.
NOCTURNAL - Primarily active at night.
CREPUSCULAR - Primarily active around dawn and dusk.


TRAITS WITHOUT A CATEGORY
These traits can be combined with categorized traits and with one another.

SPRINTING - Can sprint for short amount of time uses 3x stamina for 2x speed
VENOMOUS - Its bite leaves a toxin in the victim that keeps damaging it after the bite. Only hunters bite.
POISONOUS - Whatever bites it is left with a toxin, which lasts longer than venom and goes on working after the attacker lets go.
HARD SKIN - Has protective external covering or structures: a flat amount comes off every bite, on top of the ARMOR percentage. A bite always does at least a tenth of its damage, so nothing is invulnerable.
SPIKES - Has sharp external structures that discourage predators: the attacker takes damage for every tick it keeps biting, and only while it bites.
REGENERATION - Can regrow lost body parts: slowly heals itself while it has food and water in it.
ALARM CALLING - Warns nearby organisms of danger: an animal fleeing a predator it can see calls out, costing stamina. A call sounds for 15 ticks and is then followed by 90 ticks of silence, so an animal calls in short bursts however long the chase lasts. A call carries 0.6 loudness, reaching 1.5x view range - further than footsteps, not as far as a sprint. Only HEARING species pick it up, predators included. An animal fleeing on hearsay stays quiet, so one call cannot cascade.
NIGHT VISION - Can see effectively in low-light conditions: sees at full range at any hour, while everything else sees half as far at night and three quarters as far at dawn and dusk.
HEARING - Can detect sounds: notices alarm calls and moving animals it cannot see. How far a sound carries depends on how loud it is: an alarm call reaches 1.5x the listener's view range, a sprinting animal 1.0x and a walking one 0.25x, so moving about is nearly silent and a deliberate call is the loudest thing in the world. Sound is not dimmed by the dark, so hearing counts for more at night.