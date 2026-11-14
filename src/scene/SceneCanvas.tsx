import { useEffect, useRef } from 'react';
import type { Screen } from '../app/screens';
import type { TerrainData } from '../terrain/types';
import type { SimInfo, SimSnapshot } from '../sim/types';
import { WorldScene } from './WorldScene';

interface Props {
    screen: Screen;
    terrain?: TerrainData | null;
    simInfo?: SimInfo | null;
    snapshot?: SimSnapshot | null;
    /** Looks up the waypoints an animal follows (tile units, flat x,y pairs); used to draw the selected animal's route. */
    pathOf?: ((id: number) => number[]) | null;
    selectedId?: number | null;
    onSelect?: (id: number | null) => void;
    /** Lock the camera onto the selected animal. */
    followSelected?: boolean;
    /** Called when manual camera movement breaks the lock. */
    onFollowRelease?: () => void;
    /** Keep the lighting at midday instead of showing the visual day-night cycle (accessibility / eye strain). */
    alwaysDay?: boolean;
}

export function SceneCanvas({ screen, terrain, simInfo, snapshot, pathOf, selectedId, onSelect, followSelected, onFollowRelease, alwaysDay }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sceneRef = useRef<WorldScene | null>(null);

    // Mount/dispose only. Declared first so later effects see sceneRef set.
    useEffect(() => {
        const scene = new WorldScene(canvasRef.current!);
        sceneRef.current = scene;
        return () => {
            scene.dispose();
            sceneRef.current = null;
        };
    }, []);

    useEffect(() => {
        sceneRef.current?.setScreen(screen);
    }, [screen]);

    useEffect(() => {
        sceneRef.current?.setTerrain(terrain ?? null);
    }, [terrain]);

    useEffect(() => {
        sceneRef.current?.setSimulationInfo(simInfo ?? null);
    }, [simInfo]);

    useEffect(() => {
        sceneRef.current?.setPathProvider(pathOf ?? null);
    }, [pathOf]);

    useEffect(() => {
        sceneRef.current?.setSnapshot(snapshot ?? null);
    }, [snapshot]);

    useEffect(() => {
        sceneRef.current?.setSelectionHandler(onSelect ?? null);
    }, [onSelect]);

    useEffect(() => {
        sceneRef.current?.setSelectedAnimal(selectedId ?? null);
    }, [selectedId, simInfo, terrain]);

    useEffect(() => {
        sceneRef.current?.setFollowSelected(followSelected ?? false);
    }, [followSelected]);

    useEffect(() => {
        sceneRef.current?.setFollowReleaseHandler(onFollowRelease ?? null);
    }, [onFollowRelease]);

    useEffect(() => {
        sceneRef.current?.setAlwaysDay(alwaysDay ?? false);
    }, [alwaysDay]);

    return <canvas ref={canvasRef} className="scene-canvas" aria-hidden="true" />;
}
