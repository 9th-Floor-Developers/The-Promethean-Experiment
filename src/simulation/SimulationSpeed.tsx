import { SPEEDS } from '../sim/useSimulation';

interface Props {
    speed: number;
    onChange: (speed: number) => void;
}

/** Simulation speed slider that steps through the non-linear SPEEDS (1x, 2x, 5x, 10x, 20x). */
export function SimulationSpeed({ speed, onChange }: Props) {
    const index = Math.max(0, SPEEDS.findIndex((v) => v >= speed));
    return (
        <label className="sim-speed">
            <span className="sim-clock__label">Speed</span>
            <input
                type="range"
                min={0}
                max={SPEEDS.length - 1}
                step={1}
                value={index}
                onChange={(e) => onChange(SPEEDS[Number(e.target.value)]!)}
                aria-label="Simulation speed"
            />
            <span className="sim-clock__value">{speed}x</span>
        </label>
    );
}
