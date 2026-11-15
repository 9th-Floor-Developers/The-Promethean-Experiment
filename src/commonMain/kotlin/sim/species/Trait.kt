package sim.species

/** Categories from docs/sim/SPECIES_TRAIT.md. A species holds at most one trait per category. */
enum class TraitCategory {
    CONTROLLER, CONSUMPTION, BIRTHING, BODY_COVERING, BODY_TEMPERATURE, ACTIVITY_CYCLE
}

/** Every trait from docs/sim/SPECIES_TRAIT.md. A null [category] means the trait is uncategorized and freely combinable. */
enum class Trait(val category: TraitCategory?) {
    // CONTROLLER
    HARD_CODED(TraitCategory.CONTROLLER),
    SOFT_CODED(TraitCategory.CONTROLLER),

    // CONSUMPTION
    CARNIVORE(TraitCategory.CONSUMPTION),
    HERBIVORE(TraitCategory.CONSUMPTION),
    OMNIVORE(TraitCategory.CONSUMPTION),
    SCAVENGER(TraitCategory.CONSUMPTION),

    // BIRTHING
    LIVE_BIRTH(TraitCategory.BIRTHING),
    EGG_BIRTH(TraitCategory.BIRTHING),
    POUCH_BIRTH(TraitCategory.BIRTHING),

    // BODY COVERING
    FUR(TraitCategory.BODY_COVERING),
    FEATHERS(TraitCategory.BODY_COVERING),
    SCALES(TraitCategory.BODY_COVERING),
    EXOSKELETON(TraitCategory.BODY_COVERING),
    BARE_SKIN(TraitCategory.BODY_COVERING),
    SHELL(TraitCategory.BODY_COVERING),

    // BODY TEMPERATURE
    ENDOTHERMIC(TraitCategory.BODY_TEMPERATURE),
    ECTOTHERMIC(TraitCategory.BODY_TEMPERATURE),

    // ACTIVITY CYCLE
    DIURNAL(TraitCategory.ACTIVITY_CYCLE),
    NOCTURNAL(TraitCategory.ACTIVITY_CYCLE),
    CREPUSCULAR(TraitCategory.ACTIVITY_CYCLE),

    // Uncategorized
    CLIMBING(null),
    SPRINTING(null),
    VENOMOUS(null),
    POISONOUS(null),
    ARMOR(null),
    SPIKES(null),
    REGENERATION(null),
    ALARM_CALLING(null),
    NIGHT_VISION(null),
    HEARING(null),
}
