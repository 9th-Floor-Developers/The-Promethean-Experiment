import type { CSSProperties, ReactElement } from 'react';
import { CATEGORIES, EXTRA_TRAITS } from '../settings/speciesSettings';

/**
 * One hand-drawn icon per species trait, for the individual inspector.
 *
 * Every icon is a 24x24 line drawing in `currentColor`, so the chip around it decides the colour.
 * Drawings are local to this file - the project uses no external icon sets or models.
 */

/** The inner drawing of each trait icon, keyed by trait id (see sim/species/Trait.kt). */
const DRAWINGS: Record<string, ReactElement> = {
    // CONTROLLER
    /** Instinct: a spark of built-in wiring inside a head. */
    HARD_CODED: <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M13.8 6.6 9.6 12h4L10.2 17.4" />
    </>,
    /** Neural network: four neurons wired together, as in the network view. */
    SOFT_CODED: <>
        <circle cx="4.8" cy="12" r="1.9" /><circle cx="12" cy="6.4" r="1.9" />
        <circle cx="12" cy="17.6" r="1.9" /><circle cx="19.2" cy="12" r="1.9" />
        <path d="M6.4 11 10.4 7.6M6.4 13l4 3.4M13.6 7.6 17.6 11M13.6 16.4 17.6 13" />
    </>,

    // CONSUMPTION
    /** Plants only: a leaf with its midrib. */
    HERBIVORE: <>
        <path d="M19 4.6c0 7.6-4.4 12-11 12-2.1 0-3.6-1.6-3.6-3.9 0-5 5.7-8.1 14.6-8.1Z" />
        <path d="M15.4 8.2 6.4 19.4" />
    </>,
    /** Meat only: two fangs on a jaw line. */
    CARNIVORE: <>
        <path d="M3.8 8.4a8.2 8.2 0 0 1 16.4 0" />
        <path d="M7.8 7 9.2 15.8 10.6 7.6M13.4 7.6 14.8 15.8 16.2 7" />
    </>,
    /** Plants and meat: a leaf beside a fang. */
    OMNIVORE: <>
        <path d="M12.4 2.8c0 6.6-3.5 10.4-8.8 10.4 0-6.6 3.5-10.4 8.8-10.4Z" />
        <path d="M10.4 5.4 4.6 12.2" />
        <path d="M9.8 15.4a5.6 5.6 0 0 1 11.2 0" />
        <path d="M13.8 14.4 15.4 21 17 14.4" />
    </>,
    /** Leftovers: a bone. */
    SCAVENGER: <>
        <path d="M9 15 15 9" />
        <circle cx="6.8" cy="15.4" r="2.3" /><circle cx="8.6" cy="17.2" r="2.3" />
        <circle cx="15.4" cy="6.8" r="2.3" /><circle cx="17.2" cy="8.6" r="2.3" />
    </>,

    // BIRTHING
    /** Live birth: a baby curled up inside the parent. */
    LIVE_BIRTH: <>
        <path d="M8.4 18.4a8.2 8.2 0 1 1 7.2 0" />
        <circle cx="12" cy="18.4" r="3" />
    </>,
    /** Eggs: an egg with a crack across it. */
    EGG_BIRTH: <>
        <path d="M12 3.2c3.7 0 6.2 4.9 6.2 9 0 4.5-2.8 8.6-6.2 8.6S5.8 16.7 5.8 12.2c0-4.1 2.5-9 6.2-9Z" />
        <path d="M6.2 12.4 9 11.2l1.8 2.2 2.8-2 2.2 2 1.8-1.4" />
    </>,

    // BODY COVERING
    /** Fur: strands of hair standing off the skin. */
    FUR: <>
        <path d="M4.2 18.6h15.6" />
        <path d="M7 18.6c0-2.6 2.3-3.3 1.5-6.6M12 18.6c0-2.6 2.3-3.3 1.5-6.6M17 18.6c0-2.6 2.3-3.3 1.5-6.6" />
    </>,
    /** Feathers: a feather with its shaft and quill. */
    FEATHERS: <>
        <path d="M18.9 5c1.4 6.1-2.7 11.2-9 11.8l-3.5.4C6.9 10.5 11.9 5.2 18.9 5Z" />
        <path d="M16.6 7.3 9.5 14.4" />
        <path d="M6.4 16.6 4 19.4" />
    </>,
    /** Scales: offset rows of overlapping scales. */
    SCALES: <>
        <path d="M4.4 9.6a2.6 2.6 0 0 1 5.2 0 2.6 2.6 0 0 1 5.2 0 2.6 2.6 0 0 1 5.2 0" />
        <path d="M7 14.8a2.6 2.6 0 0 1 5.2 0 2.6 2.6 0 0 1 5.2 0" />
        <path d="M4.4 20a2.6 2.6 0 0 1 5.2 0 2.6 2.6 0 0 1 5.2 0 2.6 2.6 0 0 1 5.2 0" />
    </>,
    /** Hard outer skeleton: a segmented shell plate. */
    EXOSKELETON: <>
        <rect x="5.4" y="3.4" width="13.2" height="17.2" rx="6.6" />
        <path d="M5.7 9h12.6M5.7 13.4h12.6M6.8 17.8h10.4" />
    </>,
    /** Bare skin: a smooth patch with a few pores. */
    BARE_SKIN: <>
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <circle cx="10" cy="9.8" r="0.95" fill="currentColor" stroke="none" />
        <circle cx="15" cy="13.4" r="0.95" fill="currentColor" stroke="none" />
        <circle cx="9.4" cy="15.4" r="0.95" fill="currentColor" stroke="none" />
    </>,
    /** Shell: a ridged dome sitting on the ground. */
    SHELL: <>
        <path d="M3.4 18.4a8.6 8.6 0 0 1 17.2 0" />
        <path d="M3.4 18.4h17.2" />
        <path d="M12 9.8v8.6M7.2 11.4 5.4 18.4M16.8 11.4l1.8 7" />
    </>,

    // ACTIVITY CYCLE
    /** Daytime: a full sun. */
    DIURNAL: <>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.4M12 19v2.4M2.6 12H5M19 12h2.4M5.3 5.3 7 7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7" />
    </>,
    /** Nighttime: a crescent moon with a twinkle. */
    NOCTURNAL: <>
        <path d="M19.4 14.8A7.6 7.6 0 0 1 9.2 4.6a7.9 7.9 0 1 0 10.2 10.2Z" />
        <path d="M18.6 3.4v3.2M17 5h3.2" />
    </>,
    /** Dawn and dusk: a half sun on the horizon. */
    CREPUSCULAR: <>
        <path d="M7.2 17.4a4.8 4.8 0 0 1 9.6 0" />
        <path d="M3.4 17.4h17.2" />
        <path d="M12 7.6V5.2M6.6 9.4 5.2 8M17.4 9.4 18.8 8M4.6 14.4H3M21 14.4h-1.6" />
        <path d="M8.6 20.8h6.8" />
    </>,

    // Uncategorized extras
    /** Sprinting: motion lines behind a chevron. */
    SPRINTING: <>
        <path d="M3.6 8.4h8.8M2.6 12h10M4.6 15.6h7.8" />
        <path d="M15 6.4 20.6 12 15 17.6" />
    </>,
    /** Venomous: a fang leaving a drop of venom. */
    VENOMOUS: <>
        <path d="M4.4 7a7.6 7.6 0 0 1 15.2 0" />
        <path d="M8.6 5.4 11.9 14.4l3.3-9" />
        <path d="M11.9 21c-1.4 0-2.5-1.1-2.5-2.5 0-1.4 2.5-4 2.5-4s2.5 2.6 2.5 4c0 1.4-1.1 2.5-2.5 2.5Z" />
    </>,
    /** Poisonous: a toxin in its own flesh, left behind in whatever bites it. */
    POISONOUS: <>
        <path d="M12 2.8s5.6 6 5.6 9.4a5.6 5.6 0 1 1-11.2 0C6.4 8.8 12 2.8 12 2.8Z" />
        <path d="M10.2 10.8 13.8 14.4M13.8 10.8 10.2 14.4" />
    </>,
    /** Hard skin: a shield that takes a flat slice off every bite. */
    HARD_SKIN: <>
        <path d="M12 3.2 19.4 5.8v6.1c0 4.4-3 7.6-7.4 8.9-4.4-1.3-7.4-4.5-7.4-8.9V5.8L12 3.2Z" />
        <path d="M4.6 11.8h14.8" />
    </>,
    /** Spikes: points that hurt whatever keeps biting. */
    SPIKES: <>
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <path d="M16.4 13.1L21 12L16.4 10.9ZM15.1 8.8L16.5 4.2L13.2 7.7ZM10.8 7.7L7.5 4.2L8.9 8.8ZM7.6 10.9L3 12L7.6 13.1ZM8.9 15.2L7.5 19.8L10.8 16.3ZM13.2 16.3L16.5 19.8L15.1 15.2Z" fill="currentColor" stroke="none" />
    </>,
    /** Self-healing: health coming back around. */
    REGENERATION: <>
        <path d="M20 12a8 8 0 1 1-2.7-6" />
        <path d="M20.4 2.6v3.6h-3.6" />
        <path d="M12 9v6M9 12h6" />
    </>,
    /** Alarm calls: a shout that carries past what it can see. */
    ALARM_CALLING: <>
        <path d="M4 9.6 10.6 6.4v11.2L4 14.4Z" />
        <path d="M14 9.4a4 4 0 0 1 0 5.2M17 6.8a8 8 0 0 1 0 10.4" />
    </>,
    /** Night vision: an eye that stays open in the dark. */
    NIGHT_VISION: <>
        <path d="M2.4 12S6 6.4 12 6.4 21.6 12 21.6 12 18 17.6 12 17.6 2.4 12 2.4 12Z" />
        <path d="M14.4 12a2.7 2.7 0 1 1-3.1-2.7 3.2 3.2 0 0 0 3.1 2.7Z" />
    </>,
    /** Sharp hearing: an ear picking up sounds it cannot see. */
    HEARING: <>
        <path d="M8 9.8a4.6 4.6 0 1 1 9.2 0c0 2.3-1.7 3.2-2.9 4.1-1.1.8-1.3 1.6-1.3 2.7 0 1.7-1.3 3-3 3" />
        <path d="M11.2 10.4a1.8 1.8 0 1 1 2.9 1.4" />
        <path d="M5 7.6a5.6 5.6 0 0 0 0 4.8M2.4 6a8.6 8.6 0 0 0 0 8" />
    </>,
};

/** Trait ids grouped the way the settings screen groups them, so an icon can be tinted by category. */
const CATEGORY_OF: Record<string, string> = {
    ...Object.fromEntries(CATEGORIES.flatMap((c) => c.options.map((o) => [o.id, c.key]))),
    ...Object.fromEntries(EXTRA_TRAITS.map((t) => [t.id, 'EXTRA'])),
};

/** One cute, readable colour per trait category; extras share a colour as they are freely combinable. */
const CATEGORY_COLOR: Record<string, string> = {
    CONTROLLER: '#9b6fe0',
    CONSUMPTION: '#57b560',
    BIRTHING: '#f58fb4',
    BODY_COVERING: '#d9a066',
    ACTIVITY_CYCLE: '#3f9be8',
    EXTRA: '#f2b134',
    UNKNOWN: '#93a1c4',
};

/** The friendly label and one-line help the settings screen uses, for the chip's tooltip. */
const TRAIT_HELP: Record<string, { label: string; help: string }> = Object.fromEntries(
    [...CATEGORIES.flatMap((c) => c.options), ...EXTRA_TRAITS].map((o) => [o.id, { label: o.label, help: o.help }]),
);

/** "LIVE_BIRTH" -> "Live birth". */
function traitLabel(id: string): string {
    const text = id.toLowerCase().replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The icon of one trait on its own, drawn in the current text colour. Unknown ids fall back to a plain marker. */
export function TraitIcon({ id, size = 16 }: { id: string; size?: number }) {
    const drawing = DRAWINGS[id] ?? <><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /></>;
    return (
        <svg className="trait-chip__icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
             strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {drawing}
        </svg>
    );
}

/** Every trait of a species as an icon-and-name chip, tinted by the trait's category. */
export function TraitChips({ traits }: { traits: readonly string[] }) {
    return (
        <ul className="inspector__traits">
            {traits.map((id) => {
                const color = CATEGORY_COLOR[CATEGORY_OF[id] ?? 'UNKNOWN'];
                const described = TRAIT_HELP[id];
                return (
                    <li key={id} className="trait-chip" style={{ '--trait-color': color } as CSSProperties}
                        title={described ? `${described.label}: ${described.help}` : traitLabel(id)}>
                        <TraitIcon id={id} />
                        <span className="trait-chip__name">{traitLabel(id)}</span>
                    </li>
                );
            })}
        </ul>
    );
}
