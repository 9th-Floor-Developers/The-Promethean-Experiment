import * as THREE from 'three';
import type { Screen } from '../app/screens';
import type { TerrainData } from '../terrain/types';
import { SimActors } from './SimActors';
import type { SimInfo, SimSnapshot } from '../sim/types';
import {
    buildTerrainObject, createHeightSampler, SEABED_COLOR, SEABED_Y, WATER_COLOR, WATER_OPACITY, WATER_Y,
} from '../terrain/buildTerrainObject';

interface CameraPreset {
    position: THREE.Vector3;
    lookAt: THREE.Vector3;
}

const PRESETS: Record<Screen, CameraPreset> = {
    landing: { position: new THREE.Vector3(0, 80, 135), lookAt: new THREE.Vector3(0, 0, 0) },
    credits: { position: new THREE.Vector3(0, 30, 56), lookAt: new THREE.Vector3(0, 0, 0) },
    // 'simulation' is driven by the user-controlled camera below; this entry only supplies the fixed view direction.
    simulation: { position: new THREE.Vector3(0, 60, 62), lookAt: new THREE.Vector3(0, 0, 0) },
    opening: { position: new THREE.Vector3(0, 40, 72), lookAt: new THREE.Vector3(0, 0, 0) },
};

const SKY = 0xbfe9ff;
/** Open ocean = opaque seabed + one translucent water surface spanning island and sea (no overlapping meshes). */
const OCEAN_SIZE = 6000;
const FOG_NEAR = 220;
const FOG_FAR = 1400;
const CAMERA_DAMPING = 2.0; // higher = faster camera transition
/** On portrait/narrow viewports, pull the camera back (up to this factor) so the island isn't cropped. */
const MAX_NARROW_PULLBACK = 3;
/** Simulation camera: fixed angle; user pans the focus point on the ground and zooms along the view direction. */
const SIM_DAMPING = 10;
const SIM_FIT_MARGIN = 1.15; // initial framing leaves this much slack around the island
const SIM_MIN_ZOOM = 0.03; // closest allowed distance, as a fraction of the fit distance (close enough to watch one animal)
const SIM_MAX_ZOOM = 1.4; // farthest allowed distance, as a fraction of the fit distance
const SIM_PAN_LIMIT = 0.6; // focus may stray this fraction of the island half-extent from the center
/** The simulation opens this fraction of the way in from the whole-island view (1 = whole island in frame, smaller = closer). */
const SIM_START_ZOOM = .15;
const SIM_ROTATE_SPEED = 0.006; // radians per pixel of right-drag
const SIM_KEY_SPEED = 0.9; // WASD pan, in view-heights per second
const SIM_ZOOM_SPEED = 0.0012; // per wheel delta unit (exponential)
const CLICK_SLOP = 5; // pixels a press may move and still count as a click
const SPIN_SPEED = 0.04; // radians/sec

/** Owns all Three.js state. No React imports. */
export class WorldScene {
    private readonly canvas: HTMLCanvasElement;
    private readonly renderer: THREE.WebGLRenderer;
    private readonly scene = new THREE.Scene();
    private readonly camera: THREE.PerspectiveCamera;
    private readonly world = new THREE.Group(); // spins slowly
    private readonly clock = new THREE.Clock();
    private readonly resizeObserver: ResizeObserver;

    private terrainObject: THREE.Object3D | null = null;
    private terrainData: TerrainData | null = null;
    private actors: SimActors | null = null;
    private simInfo: SimInfo | null = null;
    private snapshot: SimSnapshot | null = null;
    private target: CameraPreset = PRESETS.landing;
    private readonly lookAt = PRESETS.landing.lookAt.clone();
    private frame = 0;
    private readonly goal = new THREE.Vector3(); // scratch: camera target after aspect pullback
    private screen: Screen = 'landing';
    private terrainHalf = new THREE.Vector2(50, 50); // island half-extent on X/Z
    private readonly simDir: THREE.Vector3; // unit vector from focus to camera (fixed angle)
    private simPitchY = 0; // fixed vertical component of the view direction
    private simYaw = 0; // orbit angle around the focus point; pitch stays fixed
    private readonly keys = new Set<string>();
    private readonly simFocus = new THREE.Vector3();
    private simDist = 100;
    private simTouched = false; // true once the user has panned/zoomed; stops auto-refit on resize
    private readonly simTarget: CameraPreset = { position: new THREE.Vector3(), lookAt: new THREE.Vector3() };
    /** Pixels covered by UI around the viewport cell (current, eased) and where they are heading. */
    private readonly inset = { left: 0, top: 0, right: 0, bottom: 0 };
    private readonly insetGoal = { left: 0, top: 0, right: 0, bottom: 0 };
    private readonly raycaster = new THREE.Raycaster();
    private selectionHandler: ((id: number | null) => void) | null = null;
    private selectedId: number | null = null;
    private followSelected = false;
    private followReleaseHandler: (() => void) | null = null;
    private readonly followPos = new THREE.Vector3();
    private drag: { id: number; x: number; y: number; startX: number; startY: number; mode: 'pan' | 'rotate' } | null = null;
    private spinning = true; // menus spin the island; the simulation view holds still
    private readonly motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        // WebGL is what uses the GPU; ask the browser for the faster one on machines that have two.
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.scene.background = new THREE.Color(SKY);
        this.scene.fog = new THREE.Fog(SKY, FOG_NEAR, FOG_FAR);

        // Static ocean (not under `world`, so it doesn't spin). The seabed sits a hair below the island's
        // identically-coloured seabed tiles (no jitter, so no visible footprint); the water surface is a single plane, so no colour seam.
        const ocean = new THREE.Group();
        const seabed = new THREE.Mesh(
            new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE),
            new THREE.MeshStandardMaterial({ color: SEABED_COLOR, flatShading: true }),
        );
        seabed.rotation.x = -Math.PI / 2;
        seabed.position.y = SEABED_Y - 0.02; // just under the island's identical seabed tiles
        const surface = new THREE.Mesh(
            new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE),
            new THREE.MeshStandardMaterial({
                color: WATER_COLOR, flatShading: true, transparent: true, opacity: WATER_OPACITY, depthWrite: false,
            }),
        );
        surface.rotation.x = -Math.PI / 2;
        surface.position.y = WATER_Y;
        ocean.add(seabed, surface);
        this.scene.add(ocean);

        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 4000);
        this.simDir = PRESETS.simulation.position.clone().sub(PRESETS.simulation.lookAt).normalize();
        this.simPitchY = this.simDir.y;
        this.camera.position.copy(PRESETS.landing.position);

        this.scene.add(
            new THREE.HemisphereLight(0xffffff, 0x88aa88, 1.1),
            this.world,
        );
        const sun = new THREE.DirectionalLight(0xffffff, 1.6);
        sun.position.set(60, 100, 40);
        this.scene.add(sun);

        this.setTerrain(null);

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(canvas);
        canvas.addEventListener('pointerdown', this.onPointerDown);
        canvas.addEventListener('pointermove', this.onPointerMove);
        canvas.addEventListener('pointerup', this.onPointerEnd);
        canvas.addEventListener('pointercancel', this.onPointerEnd);
        canvas.addEventListener('contextmenu', this.onContextMenu);
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.onBlur);
        canvas.addEventListener('wheel', this.onWheel, { passive: false });
        this.resize();

        this.loop();
    }

    /** Sets the camera target; snaps instantly when reduced motion is preferred. */
    setScreen(screen: Screen): void {
        this.screen = screen;
        this.measureInsets();
        this.spinning = screen !== 'simulation';
        this.actors?.setAnimalsVisible(screen === 'simulation');
        if (screen === 'simulation') {
            this.simTouched = false;
            this.simYaw = 0;
            this.updateSimDir();
            this.resetSimCamera();
            this.updateSimTarget();
            this.canvas.style.cursor = 'grab';
        } else {
            this.target = PRESETS[screen];
            this.canvas.style.cursor = '';
        }
        if (this.motionQuery.matches) {
            this.camera.position.copy(this.goalPosition());
            this.lookAt.copy(this.target.lookAt);
        }
    }

    setTerrain(terrain: TerrainData | null): void {
        if (this.terrainObject) {
            this.world.remove(this.terrainObject);
            disposeObject(this.terrainObject);
        }
        if (terrain) this.terrainHalf.set(terrain.width / 2, terrain.height / 2);
        if (this.screen === 'simulation' && !this.simTouched) this.resetSimCamera();
        this.terrainObject = buildTerrainObject(terrain);
        this.world.add(this.terrainObject);
        this.terrainData = terrain;
        this.rebuildActors();
    }

    /** Provides the simulation's static facts (species, trees, grass); drawn on the terrain once both are known. */
    setSimulationInfo(info: SimInfo | null): void {
        this.simInfo = info;
        this.rebuildActors();
    }

    /** Called with the clicked animal's id, or null when empty ground is clicked. */
    setSelectionHandler(handler: ((id: number | null) => void) | null): void {
        this.selectionHandler = handler;
    }

    /** While true (and an animal is selected) the camera focus tracks that animal every frame. */
    setFollowSelected(follow: boolean): void {
        this.followSelected = follow;
    }

    /** Called when the user pans manually, which releases the camera lock. */
    setFollowReleaseHandler(handler: (() => void) | null): void {
        this.followReleaseHandler = handler;
    }

    /** Stops following because the user took manual control of the camera. */
    private releaseFollow(): void {
        if (!this.followSelected) return;
        this.followSelected = false;
        this.followReleaseHandler?.();
    }

    /** Moves the focus onto the followed animal; the camera's damping smooths the motion. */
    private applyFollow(): void {
        if (!this.followSelected || this.selectedId === null || this.screen !== 'simulation') return;
        if (!this.actors?.getWorldPosition(this.selectedId, this.followPos)) return;
        this.simFocus.set(this.followPos.x, 0, this.followPos.z);
        this.simTouched = true;
        this.updateSimTarget();
    }

    /** Highlights the selected animal in the scene (null clears). */
    setSelectedAnimal(id: number | null): void {
        this.selectedId = id;
        this.actors?.setSelected(id);
    }

    /** Provides the latest simulation state; animals, carcasses and tree readiness follow it. */
    setSnapshot(snapshot: SimSnapshot | null): void {
        this.snapshot = snapshot;
        if (snapshot) this.actors?.update(snapshot);
    }

    /** (Re)creates the actor layer whenever terrain or simulation info changes. */
    private rebuildActors(): void {
        if (this.actors) {
            this.world.remove(this.actors.group);
            this.actors.dispose();
            this.actors = null;
        }
        if (!this.terrainData || !this.simInfo) return;
        const t = this.terrainData;
        this.actors = new SimActors(t.width, t.height, createHeightSampler(t));
        this.actors.setInfo(this.simInfo);
        this.actors.setAnimalsVisible(this.screen === 'simulation');
        this.actors.setSelected(this.selectedId);
        this.world.add(this.actors.group);
        if (this.snapshot) this.actors.update(this.snapshot);
    }

    resize(): void {
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        if (w === 0 || h === 0) return;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.measureInsets();
        if (this.screen === 'simulation') {
            if (!this.simTouched) this.resetSimCamera();
            this.clampSim();
            this.updateSimTarget();
        }
    }

    /** The canvas stays full-screen (one continuous shot); the sim UI covers its edges. Read how much, so the island centres in the free cell. */
    private measureInsets(): void {
        const g = this.insetGoal;
        const cell = this.screen === 'simulation' ? document.querySelector('.sim__viewport') : null;
        if (!cell) { g.left = g.top = g.right = g.bottom = 0; return; }
        const r = cell.getBoundingClientRect();
        g.left = r.left; g.top = r.top;
        g.right = this.canvas.clientWidth - r.right;
        g.bottom = this.canvas.clientHeight - r.bottom;
    }

    /** Shifts the projection so the scene centre lands in the middle of the un-covered area. */
    private applyViewOffset(): void {
        const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
        const a = this.inset;
        const moved = Math.abs(a.left) + Math.abs(a.top) + Math.abs(a.right) + Math.abs(a.bottom) > 0.5;
        if (!moved) {
            if (this.camera.view?.enabled) { this.camera.clearViewOffset(); this.camera.updateProjectionMatrix(); }
            return;
        }
        this.camera.setViewOffset(w, h, (a.right - a.left) / 2, (a.bottom - a.top) / 2, w, h);
    }

    /** Distance at which the whole island fits the viewport at the fixed angle. */
    private fitDistance(): number {
        const radius = Math.max(this.terrainHalf.x, this.terrainHalf.y) * Math.SQRT2; // corner-to-center
        const tanV0 = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2); // vertical, full canvas
        const H = this.canvas.clientHeight || 1;
        const g = this.insetGoal;
        const cellH = Math.max(H - g.top - g.bottom, 1);
        const cellW = Math.max(this.canvas.clientWidth - g.left - g.right, 1);
        const tanV = (tanV0 * cellH) / H;
        const tanH = (tanV0 * cellW) / H;
        return (radius * SIM_FIT_MARGIN) / Math.min(tanV, tanH) * 0.8;
    }

    private resetSimCamera(): void {
        this.simFocus.set(0, 0, 0);
        this.simDist = this.fitDistance() * SIM_START_ZOOM;
    }

    private clampSim(): void {
        const fit = this.fitDistance();
        this.simDist = THREE.MathUtils.clamp(this.simDist, fit * SIM_MIN_ZOOM, fit * SIM_MAX_ZOOM);
        this.simFocus.x = THREE.MathUtils.clamp(this.simFocus.x, -this.terrainHalf.x * SIM_PAN_LIMIT, this.terrainHalf.x * SIM_PAN_LIMIT);
        this.simFocus.z = THREE.MathUtils.clamp(this.simFocus.z, -this.terrainHalf.y * SIM_PAN_LIMIT, this.terrainHalf.y * SIM_PAN_LIMIT);
        this.simFocus.y = 0;
    }

    /** Recomputes the camera direction from the orbit angle; pitch is constant. */
    private updateSimDir(): void {
        const horiz = Math.sqrt(Math.max(1 - this.simPitchY * this.simPitchY, 0));
        this.simDir.set(horiz * Math.sin(this.simYaw), this.simPitchY, horiz * Math.cos(this.simYaw));
    }

    /** Ground-plane axes of the current view: `forward` points away from the camera. */
    private groundAxes(): { forward: THREE.Vector3; right: THREE.Vector3 } {
        const horiz = Math.hypot(this.simDir.x, this.simDir.z) || 1;
        const forward = new THREE.Vector3(-this.simDir.x, 0, -this.simDir.z).divideScalar(horiz);
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
        return { forward, right };
    }

    private onContextMenu = (e: Event): void => {
        if (this.screen === 'simulation') e.preventDefault();
    };

    private onKeyDown = (e: KeyboardEvent): void => {
        if (this.screen !== 'simulation' || e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        const k = e.key.toLowerCase();
        if ('wasd'.includes(k) && k.length === 1) { this.keys.add(k); e.preventDefault(); }
    };
    private onKeyUp = (e: KeyboardEvent): void => { this.keys.delete(e.key.toLowerCase()); };
    private onBlur = (): void => { this.keys.clear(); this.drag = null; };

    /** Applies held WASD keys as a pan relative to the current view. */
    private applyKeys(dt: number): void {
        if (this.screen !== 'simulation' || this.keys.size === 0) return;
        const f = (this.keys.has('w') ? 1 : 0) - (this.keys.has('s') ? 1 : 0);
        const r = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
        if (f === 0 && r === 0) return;
        this.releaseFollow();
        const { forward, right } = this.groundAxes();
        const view = 2 * this.simDist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
        const step = SIM_KEY_SPEED * view * dt;
        this.simFocus.addScaledVector(forward, f * step).addScaledVector(right, r * step);
        this.simTouched = true;
        this.clampSim();
        this.updateSimTarget();
    }

    private updateSimTarget(): void {
        this.simTarget.lookAt.copy(this.simFocus);
        this.simTarget.position.copy(this.simDir).multiplyScalar(this.simDist).add(this.simFocus);
        this.target = this.simTarget;
    }

    private onPointerDown = (e: PointerEvent): void => {
        if (this.screen !== 'simulation' || (e.button !== 0 && e.button !== 2)) return;
        this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, mode: e.button === 2 ? 'rotate' : 'pan' };
        this.canvas.setPointerCapture(e.pointerId);
        this.canvas.style.cursor = 'grabbing';
    };

    /** Drag pans the focus point across the ground plane; the view angle never changes. */
    private onPointerMove = (e: PointerEvent): void => {
        if (!this.drag || e.pointerId !== this.drag.id) return;
        const dx = e.clientX - this.drag.x;
        const dy = e.clientY - this.drag.y;
        this.drag.x = e.clientX;
        this.drag.y = e.clientY;
        if (this.drag.mode === 'pan') this.releaseFollow();
        if (this.drag.mode === 'rotate') {
            this.simYaw -= dx * SIM_ROTATE_SPEED;
            this.simTouched = true;
            this.updateSimDir();
            this.updateSimTarget();
            return;
        }
        const h = this.canvas.clientHeight || 1;
        const perPixel = (2 * this.simDist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) / h;
        const { forward, right } = this.groundAxes();
        const pitchSin = Math.max(this.simDir.y, 0.2);
        this.simFocus.addScaledVector(right, -dx * perPixel);
        this.simFocus.addScaledVector(forward, (dy * perPixel) / pitchSin);
        this.simTouched = true;
        this.clampSim();
        this.updateSimTarget();
    };

    /** A press-and-release that barely moved is a click, not a pan: pick the animal under the pointer. */
    private pickAt(e: PointerEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        this.camera.updateMatrixWorld();
        this.raycaster.setFromCamera(ndc, this.camera);
        this.selectionHandler?.(this.actors?.pick(this.raycaster) ?? null);
    }

    private onPointerEnd = (e: PointerEvent): void => {
        if (!this.drag || e.pointerId !== this.drag.id) return;
        const click = e.type === 'pointerup' && this.drag.mode === 'pan' &&
            Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) < CLICK_SLOP;
        this.drag = null;
        if (click) this.pickAt(e);
        if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
        this.canvas.style.cursor = this.screen === 'simulation' ? 'grab' : '';
    };

    private onWheel = (e: WheelEvent): void => {
        if (this.screen !== 'simulation') return;
        e.preventDefault();
        this.simDist *= Math.exp(e.deltaY * SIM_ZOOM_SPEED);
        this.simTouched = true;
        this.clampSim();
        this.updateSimTarget();
    };

    dispose(): void {
        cancelAnimationFrame(this.frame);
        this.resizeObserver.disconnect();
        this.canvas.removeEventListener('pointerdown', this.onPointerDown);
        this.canvas.removeEventListener('pointermove', this.onPointerMove);
        this.canvas.removeEventListener('pointerup', this.onPointerEnd);
        this.canvas.removeEventListener('pointercancel', this.onPointerEnd);
        this.canvas.removeEventListener('wheel', this.onWheel);
        this.canvas.removeEventListener('contextmenu', this.onContextMenu);
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('blur', this.onBlur);
        disposeObject(this.scene);
        // Do not forceContextLoss(): StrictMode re-creates the scene on the same canvas.
        this.renderer.dispose();
    }

    /** Preset camera position, pulled back along the view direction when the viewport is narrower than ~1.3:1. */
    private goalPosition(): THREE.Vector3 {
        if (this.screen === 'simulation') return this.goal.copy(this.target.position);
        const pull = THREE.MathUtils.clamp(1.3 / this.camera.aspect, 1, MAX_NARROW_PULLBACK);
        const { position, lookAt } = this.target;
        return this.goal.copy(position).sub(lookAt).multiplyScalar(pull).add(lookAt);
    }

    private loop = (): void => {
        this.frame = requestAnimationFrame(this.loop);
        const dt = Math.min(this.clock.getDelta(), 0.1);
        const k = 1 - Math.exp(-dt * (this.screen === 'simulation' ? SIM_DAMPING : CAMERA_DAMPING));
        this.applyKeys(dt);
        this.applyFollow();
        this.camera.position.lerp(this.goalPosition(), k);
        this.lookAt.lerp(this.target.lookAt, k);
        this.camera.lookAt(this.lookAt);
        const ik = this.motionQuery.matches ? 1 : k;
        for (const key of ['left', 'top', 'right', 'bottom'] as const) this.inset[key] += (this.insetGoal[key] - this.inset[key]) * ik;
        this.applyViewOffset();
        this.actors?.animate(dt);
        if (this.spinning && !this.motionQuery.matches) this.world.rotation.y += dt * SPIN_SPEED;
        this.renderer.render(this.scene, this.camera);
    };
}

function disposeObject(root: THREE.Object3D): void {
    root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const m = obj.material as THREE.Material | THREE.Material[];
            (Array.isArray(m) ? m : [m]).forEach((mat) => mat.dispose());
        }
    });
}
