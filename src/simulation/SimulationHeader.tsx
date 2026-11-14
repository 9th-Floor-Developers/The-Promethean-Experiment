import { SimulationClock } from './SimulationClock';
import { SimulationSpeed } from './SimulationSpeed';
import type { SimSnapshot } from '../sim/types';

interface Props {
    snapshot: SimSnapshot | null;
    /** Stops the simulation, discards it and returns to the previous screen. */
    onBack: () => void;
    speed: number;
    onSpeedChange: (speed: number) => void;
}

/** Narrow top bar. Back button at the far left, then the clock at the upper-left with the speed adjustor beside it. */
export function SimulationHeader({ snapshot, speed, onSpeedChange, onBack }: Props) {
    return (
        <header className="sim__header">
            <button type="button" className="sim__back" onClick={onBack}>← Back</button>
            <SimulationClock snapshot={snapshot} />
            <SimulationSpeed speed={speed} onChange={onSpeedChange} />
        </header>
    );
}
