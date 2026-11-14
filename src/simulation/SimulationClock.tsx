import { formatTime, type SimSnapshot, type TimePhase } from '../sim/types';

interface Props {
    snapshot: SimSnapshot | null;
}

/** A small sun (day, dawn, dusk) or moon (night) icon for the current phase of the day. */
function PhaseIcon({ phase }: { phase: TimePhase }) {
    if (phase === 'NIGHT') {
        return (
            <svg className="sim-clock__icon sim-clock__icon--moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor" />
            </svg>
        );
    }
    return (
        <svg className={`sim-clock__icon sim-clock__icon--sun${phase === 'DAY' ? '' : ' sim-clock__icon--low'}`} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="12" cy="12" r="4.5" fill="currentColor" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

/** Simulation time readout: in-game day and time of day, plus the day-night phase. Shows "--:--" until the simulation reports. */
export function SimulationClock({ snapshot }: Props) {
    return (
        <div className="sim-clock" aria-label="Simulation time">
            <span className="sim-clock__label">{snapshot ? `Day ${snapshot.day}` : 'Time'}</span>
            {snapshot && <PhaseIcon phase={snapshot.phase} />}
            <span className="sim-clock__value">{snapshot ? formatTime(snapshot.timeOfDay) : '--:--'}</span>
            {snapshot && <span className="sim-clock__label">{snapshot.phase.toLowerCase()}</span>}
        </div>
    );
}
