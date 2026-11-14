import { SimulationHeader } from './SimulationHeader';
import { SimulationViewport } from './SimulationViewport';
import { IndividualInspector } from './IndividualInspector';
import { useState } from 'react';
import { PopulationGraph, SimulationSummary } from './PopulationGraph';
import type { LeaderboardSettings } from './Leaderboard';
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
    onSelect: (id: number | null) => void;
    /** Whether the camera is locked onto the selected animal. */
    following: boolean;
    /** Ends the simulation and returns to the previous screen. */
    onBack: () => void;
    leaderboardSettings: LeaderboardSettings;
    onLeaderboardSettingsChange: (settings: LeaderboardSettings) => void;
    onFollowChange: (following: boolean) => void;
    history: PopulationSample[];
    /** True once every animal has died; shows the full-run graph. */
    ended: boolean;
    speed: number;
    onSpeedChange: (speed: number) => void;
}

export function SimulationScreen({ snapshot, info, selectedId, onSelect, following, onFollowChange, onBack, leaderboardSettings, onLeaderboardSettingsChange, history, ended, speed, onSpeedChange }: Props) {
    const [summaryClosed, setSummaryClosed] = useState(false);
    return (
        <div className="sim">
            <SimulationHeader snapshot={snapshot} onBack={onBack} speed={speed} onSpeedChange={onSpeedChange} />
            <SimulationViewport />
            {ended && !summaryClosed && (
                <SimulationSummary history={history} info={info} snapshot={snapshot} onClose={() => setSummaryClosed(true)} />
            )}
            <aside className="sim__sidebar" aria-label="Simulation panels">
                <IndividualInspector snapshot={snapshot} info={info} selectedId={selectedId} onSelect={onSelect} following={following} onFollowChange={onFollowChange}
                                    leaderboardSettings={leaderboardSettings} onLeaderboardSettingsChange={onLeaderboardSettingsChange} />
                <PopulationGraph history={history} info={info} snapshot={snapshot} />
            </aside>
        </div>
    );
}
