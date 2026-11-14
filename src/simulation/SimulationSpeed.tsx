import { MAX_SPEED, MIN_SPEED } from '../sim/useSimulation';

interface Props {
    speed: number;
    onChange: (speed: number) => void;
}

/** Simulation speed slider, MIN_SPEED to MAX_SPEED in whole steps (1 = base speed). */
export function SimulationSpeed({ speed, onChange }: Props) {
    return (
        <label className="sim-speed">
            <span className="sim-clock__label">Speed</span>
            <input
                type="range"
                min={MIN_SPEED}
                max={MAX_SPEED}
                step={1}
                value={speed}
                onChange={(e) => onChange(Number(e.target.value))}
                aria-label="Simulation speed"
            />
            <span className="sim-clock__value">{speed}x</span>
        </label>
    );
}
