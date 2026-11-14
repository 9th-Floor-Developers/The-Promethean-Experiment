import * as THREE from 'three';
import { buildAnimalGeometry, CARNIVORE_COLOR, HERBIVORE_COLOR } from './SimActors';

/** Size in pixels of the shared offscreen render target; portraits are drawn into it, then copied to their own 2D canvas. */
const SIZE = 128;

/** Lazily created shared WebGL resources: one renderer for every leaderboard portrait (avoids a GL context per row). */
let shared: {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    mesh: THREE.Mesh;
    rig: THREE.Group;
    geos: Map<boolean, THREE.BufferGeometry>;
} | null = null;

/** Creates the shared renderer, scene, camera and lights on first use. */
function getShared() {
    if (shared) return shared;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(SIZE, SIZE, false);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8890b0, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(2, 4, 3);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 1.9, 1.7); // looks down at the animal so its facing direction reads clearly
    camera.lookAt(0, 0.05, 0);
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }));
    const rig = new THREE.Group();
    rig.add(mesh);
    scene.add(rig);
    shared = { renderer, scene, camera, mesh, rig, geos: new Map() };
    return shared;
}

/**
 * Draws a low-poly animal (same model as the world view) onto a 2D canvas.
 * `heading` is the world yaw (0 = facing +Z, as in the main scene); `bob` lifts it for a walking animation.
 */
export function drawAnimalPortrait(canvas: HTMLCanvasElement, carnivore: boolean, heading: number, bob: number): void {
    const s = getShared();
    let geo = s.geos.get(carnivore);
    if (!geo) {
        geo = buildAnimalGeometry(carnivore ? CARNIVORE_COLOR : HERBIVORE_COLOR, carnivore);
        s.geos.set(carnivore, geo);
    }
    s.mesh.geometry = geo;
    s.rig.rotation.y = heading;
    s.mesh.position.y = bob;
    s.renderer.render(s.scene, s.camera);
    const g = canvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(s.renderer.domElement, 0, 0, canvas.width, canvas.height);
}
