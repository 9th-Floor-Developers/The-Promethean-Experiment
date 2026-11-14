import { SimulationClock } from './SimulationClock';
import { SimulationSpeed } from './SimulationSpeed';
import type { SimSnapshot } from '../sim/types';

interface Props {
    snapshot: SimSnapshot | null;
    speed: number;
    onSpeedChange: (speed: number) => void;
}

/** Narrow top bar. Clock at the upper-left with the speed adjustor beside it. */
export function SimulationHeader({ snapshot, speed, onSpeedChange }: Props) {
    return (
        <header className="sim__header">
            <SimulationClock snapshot={snapshot} />
            <SimulationSpeed speed={speed} onChange={onSpeedChange} />
        </header>
    );
}
