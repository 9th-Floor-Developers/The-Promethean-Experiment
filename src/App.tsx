import { useCallback, useEffect, useState } from 'react';
import type { Screen } from './app/screens';
import { createSimulation, type KotlinSimulation } from './sim/kotlinSim';
import { useSimulation, MIN_SPEED } from './sim/useSimulation';
import { usePopulationHistory } from './sim/usePopulationHistory';
import { DEFAULT_LEADERBOARD_SETTINGS, type LeaderboardSettings } from './simulation/Leaderboard';
import { SceneCanvas } from './scene/SceneCanvas';
import {LandingScreen} from "./screen/LandingScreen.tsx";
import {OpeningScreen} from "./screen/OpeningScreen.tsx";
import {SimulationScreen} from "./simulation/SimulationScreen.tsx";
import {CreditsScreen} from "./screen/CreditsScreen.tsx";

export default function App() {
    const [screen, setScreen] = useState<Screen>('landing');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    // Lives here (not in the leaderboard) so the choices survive selecting an animal and leaving the screen.
    const [leaderboardSettings, setLeaderboardSettings] = useState<LeaderboardSettings>(DEFAULT_LEADERBOARD_SETTINGS);
    const [following, setFollowing] = useState(false);
    const [sim, setSim] = useState<KotlinSimulation | null>(null);

    // The world (terrain, animals, objects) comes from the Kotlin simulation compiled to Wasm, not from TypeScript.
    useEffect(() => {
        createSimulation().then(setSim).catch((e) => console.error('Kotlin simulation failed to start', e));
    }, []);

    // Ticks only while the simulation screen is open; leaving it pauses the world where it is.
    const [speed, setSpeed] = useState(MIN_SPEED);
    const [ended, setEnded] = useState(false);
    const snapshot = useSimulation(sim, screen === 'simulation' && !ended, speed);
    // The simulation ends when every animal has died; ticking stops and the full history is shown.
    useEffect(() => {
        if (snapshot && snapshot.tick > 0 && snapshot.animals.length === 0) setEnded(true);
    }, [snapshot]);
    const history = usePopulationHistory(snapshot, sim?.info ?? null);

    // The camera lock only makes sense while an animal is selected.
    useEffect(() => {
        if (selectedId === null) setFollowing(false);
    }, [selectedId]);
    const releaseFollow = useCallback(() => setFollowing(false), []);

    const [cameFromCredits, setCameFromCredits] = useState(false);
    const closeCredits = useCallback(() => {
        setCameFromCredits(true);
        setScreen('opening');
    }, []);

    return (
        <>
            {/* Persistent: never unmounted, so the same 3D scene lives across screens. */}
            <SceneCanvas screen={screen} terrain={sim?.terrain ?? null} simInfo={sim?.info ?? null} snapshot={snapshot} selectedId={selectedId} onSelect={setSelectedId} followSelected={following} onFollowRelease={releaseFollow} />
            <main className="ui-layer">
                {screen === 'landing' && <LandingScreen onStart={() => setScreen('opening')} />}
                {screen === 'opening' && (
                    <OpeningScreen
                        onStartSimulation={() => setScreen('simulation')}
                        onOpenCredits={() => setScreen('credits')}
                        focusCredits={cameFromCredits}
                    />
                )}
                {screen === 'simulation' && <SimulationScreen snapshot={snapshot} info={sim?.info ?? null} selectedId={selectedId} onSelect={setSelectedId} following={following} onFollowChange={setFollowing}
                    leaderboardSettings={leaderboardSettings} onLeaderboardSettingsChange={setLeaderboardSettings} history={history} ended={ended} speed={speed} onSpeedChange={setSpeed} />}
                {screen === 'credits' && <CreditsScreen onBack={closeCredits} />}
            </main>
        </>
    );
}
