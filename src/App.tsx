import { useCallback, useEffect, useRef, useState } from 'react';
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
import {SettingsScreen} from "./screen/SettingsScreen.tsx";
import { toSpeciesConfig } from './settings/speciesSettings';
import { activePreset, loadPresetStore, savePresetStore, type PresetStore } from './settings/presets';

export default function App() {
    const [screen, setScreen] = useState<Screen>('landing');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    // Lives here (not in the leaderboard) so the choices survive selecting an animal and leaving the screen.
    const [leaderboardSettings, setLeaderboardSettings] = useState<LeaderboardSettings>(DEFAULT_LEADERBOARD_SETTINGS);
    const [following, setFollowing] = useState(false);
    const [sim, setSim] = useState<KotlinSimulation | null>(null);
    // Which species run, how many, their stats and traits; edited on the Settings screen, used whenever a world is built.
    const [presetStore, setPresetStore] = useState<PresetStore>(loadPresetStore);
    const settings = activePreset(presetStore).settings;
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    const settingsDirty = useRef(false);

    // The world (terrain, animals, objects) comes from the Kotlin simulation compiled to Wasm, not from TypeScript.
    useEffect(() => {
        createSimulation(undefined, settingsRef.current.mapSize, toSpeciesConfig(settingsRef.current), settingsRef.current).then(setSim).catch((e) => console.error('Kotlin simulation failed to start', e));
    }, []);

    // Ticks only while the simulation screen is open; leaving it pauses the world where it is.
    const [speed, setSpeed] = useState<number>(MIN_SPEED);
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

    /**
     * Back from the simulation: stops it, throws the world away and builds a fresh one (same seed, so the same terrain),
     * clears everything tied to the old run and returns to the opening screen, which shows just the terrain.
     */
    const endSimulation = useCallback(() => {
        setScreen('opening');
        setSelectedId(null);
        setFollowing(false);
        setEnded(false);
        setSpeed(MIN_SPEED);
        createSimulation(undefined, settingsRef.current.mapSize, toSpeciesConfig(settingsRef.current), settingsRef.current).then(setSim).catch((e) => console.error('Kotlin simulation failed to restart', e));
    }, []);

    const [cameFromCredits, setCameFromCredits] = useState(false);
    const closeCredits = useCallback(() => {
        setCameFromCredits(true);
        setScreen('opening');
    }, []);

    /** Any preset edit, switch, creation or deletion: saved at once, and the world is rebuilt when Settings closes. */
    const changePresets = useCallback((next: PresetStore) => {
        settingsDirty.current = true;
        savePresetStore(next);
        setPresetStore(next);
    }, []);
    /** Leaves Settings; if anything changed, saves it and rebuilds the world so the next run uses it. */
    const closeSettings = useCallback(() => {
        setScreen('opening');
        if (!settingsDirty.current) return;
        settingsDirty.current = false;
        createSimulation(undefined, settingsRef.current.mapSize, toSpeciesConfig(settingsRef.current), settingsRef.current).then(setSim).catch((e) => console.error('Kotlin simulation failed to rebuild', e));
    }, []);

    return (
        <>
            {/* Persistent: never unmounted, so the same 3D scene lives across screens. */}
            <SceneCanvas screen={screen} terrain={sim?.terrain ?? null} simInfo={sim?.info ?? null} snapshot={snapshot} pathOf={sim?.animalPath ?? null} selectedId={selectedId} onSelect={setSelectedId} followSelected={following} onFollowRelease={releaseFollow} />
            <main className="ui-layer">
                {screen === 'landing' && <LandingScreen onStart={() => setScreen('opening')} />}
                {screen === 'opening' && (
                    <OpeningScreen
                        onStartSimulation={() => setScreen('simulation')}
                        onOpenCredits={() => setScreen('credits')}
                        onOpenSettings={() => setScreen('settings')}
                        focusCredits={cameFromCredits}
                    />
                )}
                {screen === 'simulation' && <SimulationScreen snapshot={snapshot} info={sim?.info ?? null} selectedId={selectedId} onSelect={setSelectedId} objectInfoOf={sim?.objectInfo ?? null} following={following} onFollowChange={setFollowing} onBack={endSimulation}
                    leaderboardSettings={leaderboardSettings} onLeaderboardSettingsChange={setLeaderboardSettings} history={history} ended={ended} onEnd={() => setEnded(true)} speed={speed} onSpeedChange={setSpeed} />}
                {screen === 'settings' && <SettingsScreen store={presetStore} onChange={changePresets} onDone={closeSettings} />}
                {screen === 'credits' && <CreditsScreen onBack={closeCredits} />}
            </main>
        </>
    );
}
