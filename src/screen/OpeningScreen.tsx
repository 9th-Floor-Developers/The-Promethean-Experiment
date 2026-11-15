import { useEffect, useRef } from 'react';
import { drawAnimalPortrait } from '../scene/animalPortrait';
import type { SpeciesSettings } from '../settings/speciesSettings';

/** Swallows held-key repeats so a key held on the previous screen can't trigger a button here. */
function ignoreRepeat(e: React.KeyboardEvent): void {
    if (e.repeat) e.preventDefault();
}

interface Props {
    onStartSimulation: () => void;
    onOpenCredits: () => void;
    onOpenSettings: () => void;
    /** True when returning from Credits: focus the Credits button instead of Start. */
    focusCredits?: boolean;
    /** Name of the active preset and its species, shown as a quick summary of what Start Simulation will run. */
    presetName: string;
    species: SpeciesSettings[];
}

/** Turn speed (radians per second) of the spinning species models. */
const SPIN_SPEED = 0.9;

/** A small model of a species that slowly turns on the spot (stays still when the user prefers reduced motion). */
function SpinningModel({ look, offset }: { look: number; offset: number }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        if (still) {
            if (ref.current) drawAnimalPortrait(ref.current, look, 0.7, 0);
            return;
        }
        let frame = 0;
        const loop = (now: number) => {
            frame = requestAnimationFrame(loop);
            if (ref.current) drawAnimalPortrait(ref.current, look, offset + (now / 1000) * SPIN_SPEED, 0);
        };
        frame = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frame);
    }, [look, offset]);
    return <canvas ref={ref} className="roster__model" width={64} height={64} aria-hidden="true" />;
}

/** Compact list of the species in the active preset: spinning model, name and starting count. Full details live in Settings. */
function SpeciesRoster({ presetName, species }: { presetName: string; species: SpeciesSettings[] }) {
    return (
        <section className="roster" aria-labelledby="roster-heading">
            <h2 id="roster-heading" className="roster__heading">In this simulation</h2>
            <p className="roster__preset">{presetName}</p>
            <ul className="roster__list">
                {species.map((sp, i) => (
                    <li key={sp.uid} className="roster__item">
                        <SpinningModel look={sp.look} offset={i * 1.3} />
                        <span className="roster__name">{sp.name.trim() || 'Species'}</span>
                        <span className="roster__count">{sp.count} {sp.count === 1 ? 'animal' : 'animals'}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/**
 * Opening / main-menu screen: title top-left, then Start Simulation,
 * Settings and Credits, plus a small summary of the species the active preset will run.
 * Moves keyboard focus on mount, since the previous screen's control has unmounted.
 */
export function OpeningScreen({ onStartSimulation, onOpenCredits, focusCredits, onOpenSettings, presetName, species }: Props) {
    const startRef = useRef<HTMLButtonElement>(null);
    const creditsRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        (focusCredits ? creditsRef : startRef).current?.focus();
    }, [focusCredits]);

    return (
        <div className="opening">
            <h1 className="opening__title">The Promethean Experiment</h1>
            <nav className="opening__menu" aria-label="Main menu" onKeyDown={ignoreRepeat}>
                <button ref={startRef} type="button" className="btn btn--primary" onClick={onStartSimulation}>
                    Start Simulation
                </button>
                <button type="button" className="btn" onClick={onOpenSettings}>
                    Settings
                </button>
                <button ref={creditsRef} type="button" className="btn" onClick={onOpenCredits}>
                    Credits
                </button>
            </nav>
            <SpeciesRoster presetName={presetName} species={species} />
        </div>
    );
}
