import { SimulationHeader } from './SimulationHeader';
import { SimulationViewport } from './SimulationViewport';
import { IndividualInspector } from './IndividualInspector';
import { PopulationGraph } from './PopulationGraph';
import type { SimInfo, SimSnapshot } from '../sim/types';
import type { PopulationSample } from '../sim/usePopulationHistory';

/**
 * Simulation workspace layout: header (top), viewport (left), sidebar (right: inspector over population graph).
 * Pure layout. The 3D canvas is owned by the persistent SceneCanvas and is sized to the viewport cell via CSS.
 */
interface Props {
    snapshot: SimSnapshot | null;
    info: SimInfo | null;
    selectedId: number | null;
    history: PopulationSample[];
    speed: number;
    onSpeedChange: (speed: number) => void;
}

export function SimulationScreen({ snapshot, info, selectedId, history, speed, onSpeedChange }: Props) {
    return (
        <div className="sim">
            <SimulationHeader snapshot={snapshot} speed={speed} onSpeedChange={onSpeedChange} />
            <SimulationViewport />
            <aside className="sim__sidebar" aria-label="Simulation panels">
                <IndividualInspector snapshot={snapshot} info={info} selectedId={selectedId} />
                <PopulationGraph history={history} info={info} snapshot={snapshot} />
            </aside>
        </div>
    );
}
