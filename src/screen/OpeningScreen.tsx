import { useEffect, useRef } from 'react';

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
}

/**
 * Opening / main-menu screen: title top-left, then Start Simulation,
 * Settings and Credits.
 * Moves keyboard focus on mount, since the previous screen's control has unmounted.
 */
export function OpeningScreen({ onStartSimulation, onOpenCredits, focusCredits, onOpenSettings }: Props) {
    const startRef = useRef<HTMLButtonElement>(null);
    const creditsRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        (focusCredits ? creditsRef : startRef).current?.focus();
    }, [focusCredits]);

    return (
        <div className="opening">
            <h1 className="opening__title">The Prometheus Experiment</h1>
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
        </div>
    );
}
