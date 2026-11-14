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

FUR - Has a coat of hair or fur.
FEATHERS - Has feathers covering some or all of its body.
SCALES - Has scales covering its body.
EXOSKELETON - Has a hard external skeleton.
BARE SKIN - Has exposed skin without a substantial external covering.
SHELL - Has a hard protective shell.


BODY TEMPERATURE

ENDOTHERMIC - Generates internal heat to help maintain body temperature.
ECTOTHERMIC - Relies primarily on external heat sources to regulate body temperature.


ACTIVITY CYCLE

DIURNAL - Primarily active during the day.
NOCTURNAL - Primarily active at night.
CREPUSCULAR - Primarily active around dawn and dusk.


SOCIAL BEHAVIOR

SOLITARY - Usually lives independently.
HERDING - Lives and moves in groups.
PACK - Lives or hunts in coordinated groups.



TRAITS WITHOUT A CATEGORY
These traits can be combined with categorized traits and with one another.

CLIMBING - Can climb trees and vertical surfaces.
SPRINTING - Can sprint for short amount of time
VENOMOUS - Produces venom that can harm other organisms.
POISONOUS - Contains toxins that can harm organisms that consume it.
ARMOR - Has protective external covering or structures.
SPIKES - Has sharp external structures that discourage predators.
REGENERATION - Can regrow lost body parts.
ALARM CALLING - Warns nearby organisms of danger.
NIGHT VISION - Can see effectively in low-light conditions.
HEARING - Can detect sounds.