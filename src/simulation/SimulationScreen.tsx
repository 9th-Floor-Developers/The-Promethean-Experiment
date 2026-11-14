import { SimulationHeader } from './SimulationHeader';
import { SimulationViewport } from './SimulationViewport';
import { IndividualInspector } from './IndividualInspector';
import { useState } from 'react';
import { TitleEffects } from './TitleEffects';
import { PopulationGraph, StatisticsPage } from './PopulationGraph';
import type { LeaderboardSettings } from './Leaderboard';
import type { ObjectInfo, SimInfo, SimSnapshot } from '../sim/types';
import type { TraitStats } from '../sim/useTraitStats';
import type { PopulationSample } from '../sim/usePopulationHistory';

/**
 * Simulation workspace layout: header (top), viewport (left), sidebar (right: inspector over population graph).
 * Pure layout. The 3D canvas is owned by the persistent SceneCanvas and is sized to the viewport cell via CSS.
 */
interface Props {
    snapshot: SimSnapshot | null;
    info: SimInfo | null;
    selectedId: number | null;
    onSelect: (id: number | null) => void;
    /** Looks up the details of a selected tree, grass tuft, carcass or egg. */
    objectInfoOf: ((id: number) => ObjectInfo | null) | null;
    /** Whether the camera is locked onto the selected animal. */
    following: boolean;
    /** Ends the simulation and returns to the previous screen. */
    onBack: () => void;
    leaderboardSettings: LeaderboardSettings;
    onLeaderboardSettingsChange: (settings: LeaderboardSettings) => void;
    onFollowChange: (following: boolean) => void;
    history: PopulationSample[];
    traitStats: TraitStats;
    /** True once every animal has died; shows the full-run graph. */
    ended: boolean;
    /** Ends the run early, exactly as if every animal had died. */
    onEnd: () => void;
    speed: number;
    onSpeedChange: (speed: number) => void;
}

export function SimulationScreen({ snapshot, info, selectedId, onSelect, objectInfoOf, following, onFollowChange, onBack, leaderboardSettings, onLeaderboardSettingsChange, history, traitStats, ended, onEnd, speed, onSpeedChange }: Props) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [overview, setOverview] = useState(false);
    return (
        <div className={`sim${sidebarOpen ? '' : ' sim--no-sidebar'}`}>
            <SimulationHeader snapshot={snapshot} onBack={onBack} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((o) => !o)} speed={speed} onSpeedChange={onSpeedChange} ended={ended} onEnd={() => { onEnd(); }} />
            <SimulationViewport />
            <TitleEffects snapshot={snapshot} info={info} />
            {(overview || ended) && <StatisticsPage traitStats={traitStats} ended={ended} history={history} info={info} snapshot={snapshot} onAction={ended ? onBack : () => setOverview(false)} />}
            <aside className="sim__sidebar" aria-label="Simulation panels">
                <IndividualInspector snapshot={snapshot} info={info} selectedId={selectedId} onSelect={onSelect} objectInfoOf={objectInfoOf} following={following} onFollowChange={onFollowChange}
                                    leaderboardSettings={leaderboardSettings} onLeaderboardSettingsChange={onLeaderboardSettingsChange} />
                <PopulationGraph history={history} info={info} snapshot={snapshot} onExpand={() => setOverview(true)} />
            </aside>
        </div>
    );
}
