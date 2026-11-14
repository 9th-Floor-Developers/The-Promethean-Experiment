import { formatTime, type SimSnapshot } from '../sim/types';

interface Props {
    snapshot: SimSnapshot | null;
}

/** Simulation time readout: in-game day and time of day, plus the day-night phase. Shows "--:--" until the simulation reports. */
export function SimulationClock({ snapshot }: Props) {
    return (
        <div className="sim-clock" aria-label="Simulation time">
            <span className="sim-clock__label">{snapshot ? `Day ${snapshot.day}` : 'Time'}</span>
            <span className="sim-clock__value">{snapshot ? formatTime(snapshot.timeOfDay) : '--:--'}</span>
            {snapshot && <span className="sim-clock__label">{snapshot.phase.toLowerCase()}</span>}
        </div>
    );
}
