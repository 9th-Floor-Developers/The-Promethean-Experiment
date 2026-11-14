import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { A, NO_HEADING, type SimInfo, type SimSnapshot } from '../sim/types';

/** Ground height at continuous tile coordinates, see createHeightSampler. */
export type HeightFn = (tx: number, ty: number) => number;

const TREE_SCALE = 1.3;
const ANIMAL_SCALE = 1.5;
const FOLIAGE_READY = new THREE.Color(0x3fbf5f);
const FOLIAGE_RESTING = new THREE.Color(0x9aa84f);
const GRASS_READY = new THREE.Color(0x5fd35a);
const GRASS_RESTING = new THREE.Color(0xb9b86a);
export const CARNIVORE_COLOR = 0xff7a45;
export const HERBIVORE_COLOR = 0xfff1d6;
const OTHER_COLOR = 0xb18cff;
/** Colour of the destination marker, route line and arrows by the action being carried out. */
const ROUTE_COLORS: Record<string, number> = {
    ATTACK_TARGET: 0xff4d4d,
    DRINK_WATER: 0x3aa0ff,
    EAT_FOOD: 0x5ce65c,
    REPRODUCE_WITH: 0xff7ad9,
    EXPLORE: 0xb18cff,
};
const ROUTE_FALLBACK_COLOR = 0xffffff;
/** How far (world units) the view-range layer floats above the terrain so it never sinks into it. */
const VIEW_LAYER_LIFT = 0.1;
/** Emissive intensity of animals at full night, so they stay visible in the dark. */
const NIGHT_GLOW_MAX = 0.45;
/** Colours of the direction arrow shown when there is no destination (fleeing, wandering). */
const HEADING_COLORS: Record<string, number> = { RUN_FROM_PREDATOR: 0xffa63d, WANDER: 0xd5dde2 };
/** Length (world units) of the direction arrow. */
const HEADING_LENGTH = 3;
/** Most points of a route that are drawn, and most arrowheads along it. */
const ROUTE_MAX_POINTS = 512;
const ARROW_MAX = 300;
/** World-space distance between arrowheads along the route. */
const ARROW_SPACING = 1.6;

/** "RUN_FROM_PREDATOR" -> "Run from predator". */
function actionLabel(name: string): string {
    const text = name.toLowerCase().replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A grass tuft: three thin leaning blades merged into one geometry, base at y = 0. */
function buildGrassGeometry(): THREE.BufferGeometry {
    const blades = [0, 1, 2].map((k) => {
        const blade = new THREE.ConeGeometry(0.05, 0.3 + k * 0.05, 4);
        blade.translate(0, (0.3 + k * 0.05) / 2, 0);
        blade.rotateZ((k - 1) * 0.35);
        blade.rotateY(k * 2.1);
        blade.translate((k - 1) * 0.05, 0, (1 - k) * 0.03);
        return blade;
    });
    const merged = mergeGeometries(blades)!;
    blades.forEach((b) => b.dispose());
    return merged;
}

/**
 * Builds one cute low-poly animal (body, head, two ears, two eyes) as a single vertex-coloured geometry,
 * facing +Z. Carnivores get short pointed ears, others tall ones.
 */
export function buildAnimalGeometry(color: number, carnivore: boolean): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const part = (geo: THREE.BufferGeometry, hex: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
        const g = geo.index ? geo.toNonIndexed() : geo; // merging needs every part indexed or none
        g.scale(sx, sy, sz);
        g.translate(x, y, z);
        const c = new THREE.Color(hex);
        const colors = new Float32Array(g.attributes.position!.count * 3);
        for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        parts.push(g);
    };
    part(new THREE.IcosahedronGeometry(0.28, 0), color, 0, 0, 0, 1, 0.85, 1.3);
    part(new THREE.IcosahedronGeometry(0.19, 0), color, 0, 0.16, 0.32);
    for (const side of [-1, 1]) {
        if (carnivore) part(new THREE.ConeGeometry(0.07, 0.2, 4), color, side * 0.1, 0.34, 0.3);
        else part(new THREE.ConeGeometry(0.07, 0.2, 4), color, side * 0.08, 0.42, 0.28, 0.9, 1.6, 0.9);
        part(new THREE.SphereGeometry(0.035, 5, 4), 0x222222, side * 0.08, 0.21, 0.47);
    }
    const merged = mergeGeometries(parts)!;
    parts.forEach((g) => g.dispose());
    return merged;
}

/** Deterministic pseudo-random 0..1 from an integer, so scenery looks the same every run. */
function hash01(n: number): number {
    let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/** Overhead text effects (docs/visuals/OVERHEAD_EFFECTS.MD): seconds a popup lives, how far it rises, and limits. */
const POPUP_LIFE = 1.3;
const POPUP_RISE = 1.0;
const POPUP_HEIGHT = 0.55;
const MAX_POPUPS = 120;
/** Minimum seconds between damage popups on one animal; damage in between is summed into the next one. */
const DAMAGE_POPUP_GAP = 0.5;
const DAMAGE_COLOR = '#ff4d4d';
const ACTION_COLOR = '#ffffff';

/** A floating text sprite that rises and fades out. */
interface Popup {
    sprite: THREE.Sprite;
    age: number;
    baseY: number;
}

/** Seconds after which the scene clock is shifted back, so float32 timestamps in the shader never lose precision. */
const CLOCK_REBASE = 1800;
/** Radius (world units) within which a click selects an animal; generous so small animals are easy to hit. */
const PICK_RADIUS = 0.7 * ANIMAL_SCALE;

/**
 * All animals of one species drawn with a single instanced draw call. Each animal's previous and current simulation
 * position, headings and update time live in per-instance GPU attributes; the vertex shader interpolates between them
 * every frame (see the material in SimActors), so the CPU only writes data when a new snapshot arrives.
 */
class AnimalBatch {
    readonly mesh: THREE.Mesh;
    /** Animal id stored in each slot, so a swap-removal can tell which animal moved. */
    readonly ids: number[] = [];
    private readonly geo = new THREE.InstancedBufferGeometry();
    private capacity = 0;
    from = new Float32Array(0);
    to = new Float32Array(0);
    /** Per instance: update time, interpolation duration, heading before, heading after. */
    info = new Float32Array(0);
    seed = new Float32Array(0);
    dirty = false;

    constructor(source: THREE.BufferGeometry, material: THREE.Material) {
        this.geo.copy(source as unknown as THREE.InstancedBufferGeometry);
        this.geo.instanceCount = 0;
        this.grow(256);
        this.mesh = new THREE.Mesh(this.geo, material);
        this.mesh.frustumCulled = false; // positions are computed in the shader, so the CPU-side bounds do not apply
    }

    get count(): number { return this.ids.length; }

    /** Reallocates the instance buffers with room for at least `cap` animals, keeping the existing data. */
    private grow(cap: number): void {
        const keep = (old: Float32Array, size: number) => { const a = new Float32Array(cap * size); a.set(old.subarray(0, this.ids.length * size)); return a; };
        this.from = keep(this.from, 3); this.to = keep(this.to, 3); this.info = keep(this.info, 4); this.seed = keep(this.seed, 1);
        const attr = (name: string, data: Float32Array, size: number) => {
            const a = new THREE.InstancedBufferAttribute(data, size);
            a.setUsage(THREE.DynamicDrawUsage);
            this.geo.setAttribute(name, a);
        };
        attr('aFrom', this.from, 3); attr('aTo', this.to, 3); attr('aInfo', this.info, 4); attr('aSeed', this.seed, 1);
        this.capacity = cap;
    }

    /** Reserves a slot for animal `id` and returns its index. */
    add(id: number): number {
        if (this.ids.length >= this.capacity) this.grow(this.capacity * 2);
        this.ids.push(id);
        this.dirty = true;
        return this.ids.length - 1;
    }

    /** Frees `slot` by moving the last animal into it; returns the id that moved (or undefined if none did). */
    remove(slot: number): number | undefined {
        const last = this.ids.length - 1;
        let moved: number | undefined;
        if (slot !== last) {
            this.from.copyWithin(slot * 3, last * 3, last * 3 + 3);
            this.to.copyWithin(slot * 3, last * 3, last * 3 + 3);
            this.info.copyWithin(slot * 4, last * 4, last * 4 + 4);
            this.seed[slot] = this.seed[last]!;
            moved = this.ids[last]!;
            this.ids[slot] = moved;
        }
        this.ids.pop();
        this.dirty = true;
        return moved;
    }

    /** Writes one animal's interpolation state into its slot. */
    write(slot: number, id: number, from: THREE.Vector3, to: THREE.Vector3, t0: number, dur: number, headFrom: number, headTo: number): void {
        this.from[slot * 3] = from.x; this.from[slot * 3 + 1] = from.y; this.from[slot * 3 + 2] = from.z;
        this.to[slot * 3] = to.x; this.to[slot * 3 + 1] = to.y; this.to[slot * 3 + 2] = to.z;
        this.info[slot * 4] = t0; this.info[slot * 4 + 1] = dur; this.info[slot * 4 + 2] = headFrom; this.info[slot * 4 + 3] = headTo;
        this.seed[slot] = id % 997;
        this.dirty = true;
    }

    /** Uploads changed data to the GPU and sets how many animals are drawn. */
    flush(): void {
        if (!this.dirty) return;
        for (const name of ['aFrom', 'aTo', 'aInfo', 'aSeed']) (this.geo.getAttribute(name) as THREE.InstancedBufferAttribute).needsUpdate = true;
        this.geo.instanceCount = this.ids.length;
        this.dirty = false;
    }

    dispose(): void { this.geo.dispose(); }
}

interface Actor {
    /** Which AnimalBatch draws this animal, and its slot in it. */
    batch: number;
    slot: number;
    /** Where the interpolation started (the animal's drawn position when the last snapshot arrived) and where it ends. */
    from: THREE.Vector3;
    /** Scene-clock time of the last snapshot for this animal, and how long the interpolation to it lasts. */
    t0: number;
    dur: number;
    fromHeading: number;
    hp: number;
    action: number;
    /** Damage taken since the last damage popup. */
    pendingDamage: number;
    /** Value of the scene clock when the last damage popup was shown. */
    lastDamagePopup: number;
    target: THREE.Vector3;
    targetHeading: number;
    seen: number;
}

/**
 * Draws the Kotlin simulation's contents (animals, trees, grass, carcasses) as low-poly meshes.
 * Pure view code: it never changes simulation state. Animals are interpolated between ticks.
 * Everything is placed in the island's coordinates (centred on the origin, 1 world unit per tile).
 */
export class SimActors {
    /** Parent for everything this class draws; add it to the world group. */
    readonly group = new THREE.Group();
    private readonly sceneryGroup = new THREE.Group();
    private readonly animalGroup = new THREE.Group();

    private readonly actors = new Map<number, Actor>();
    private readonly popups: Popup[] = [];
    private readonly textures = new Map<string, THREE.CanvasTexture>();
    private actionNames: string[] = [];
    private readonly carcasses = new Map<number, THREE.Mesh>();
    private foliage: THREE.InstancedMesh | null = null;
    private lastTrees = '';
    private grassMesh: THREE.InstancedMesh | null = null;
    private lastGrass = '';
    private updateCount = 0;
    private clockTime = 0;
    private readonly owned: { dispose(): void }[] = [];

    /** One merged mesh geometry per species (body, head, ears and eyes baked together). */
    private readonly animalGeos: THREE.BufferGeometry[] = [];
    /** One instanced draw call per species. */
    private batches: AnimalBatch[] = [];
    /** Scene clock (seconds) shared with the animal shader, which interpolates positions from it. */
    private readonly uNow = { value: 0 };
    private lastUpdateClock = 0;
    /** Smoothed seconds between snapshots; animals take this long to glide to their new position. */
    private updateInterval = 1 / 30;
    private readonly tmpV = new THREE.Vector3();
    private readonly tmpV2 = new THREE.Vector3();
    private readonly pickSphere = new THREE.Sphere();
    private readonly pickRay = new THREE.Ray();
    private readonly pickInv = new THREE.Matrix4();
    /** Follows the selected animal and carries the selection ring (animals are no longer separate objects to hold it). */
    private readonly ringHolder = new THREE.Group();
    private readonly animalMat = this.own(this.makeAnimalMaterial());
    private readonly ringGeo = this.own(new THREE.RingGeometry(0.42, 0.56, 24));
    private readonly ringMat = this.own(new THREE.MeshBasicMaterial({
        color: 0xffd23f, side: THREE.DoubleSide, depthTest: false, transparent: true,
    }));
    private readonly ring = new THREE.Mesh(this.ringGeo, this.ringMat);
    private readonly viewTileMat = this.own(new THREE.MeshBasicMaterial({
        color: 0xffd23f, transparent: true, opacity: 0.28, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    }));
    private selectedId: number | null = null;

    /** View range (tiles) of each species, indexed like the animal rows' species column. */
    private viewRanges: number[] = [];
    /** Flat yellow tiles marking everything the selected animal can see; one instance per tile in range. */
    private viewOverlay: THREE.Mesh | null = null;
    /** Last sim position and species of the selected animal, so the overlay can be rebuilt on selection. */
    private selectedRow: { x: number; y: number; range: number } | null = null;
    /** Latest sim position and species of every living animal, for showing the overlay as soon as one is selected. */
    private readonly lastRows = new Map<number, { x: number; y: number; range: number }>();

    /** Colour shared by everything that shows the selected animal's route; changed with its action. */
    private readonly routeColor = new THREE.Color(ROUTE_FALLBACK_COLOR);
    /** Ring on the tile the selected animal is walking to. */
    private readonly destMarker = new THREE.Mesh(
        this.own(new THREE.RingGeometry(0.3, 0.46, 20).rotateX(-Math.PI / 2)),
        this.own(new THREE.MeshBasicMaterial({ color: this.routeColor, side: THREE.DoubleSide, depthTest: false, transparent: true })));
    /** Line along the selected animal's route: from the animal, around obstacles, to its destination. */
    private readonly destLine = new THREE.Line(
        this.own(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(ROUTE_MAX_POINTS * 3), 3))),
        this.own(new THREE.LineBasicMaterial({ color: this.routeColor, depthTest: false, transparent: false })));
    /** Arrowheads along the route showing which way it leads. */
    private readonly routeArrows = new THREE.InstancedMesh(
        this.own(new THREE.ConeGeometry(0.13, 0.4, 6).rotateX(Math.PI / 2)),
        this.own(new THREE.MeshBasicMaterial({ color: this.routeColor, depthTest: false, transparent: false })), ARROW_MAX);
    /** Destination of the selected animal in tile units, or null when it has none. */
    private selectedDest: { x: number; y: number } | null = null;
    /** Direction (radians, tile axes) the selected animal is wandering or fleeing in, or null when it has none. */
    private selectedHeading: number | null = null;
    /** Waypoints (tile units, flat x,y pairs) the selected animal follows around obstacles. */
    private selectedWaypoints: number[] = [];
    private pathProvider: ((id: number) => number[]) | null = null;
    private readonly routePts: THREE.Vector3[] = [];
    private readonly arrowQuat = new THREE.Quaternion();
    private readonly arrowMatrix = new THREE.Matrix4();
    private readonly arrowPos = new THREE.Vector3();
    private readonly arrowDir = new THREE.Vector3();
    private readonly arrowForward = new THREE.Vector3(0, 0, 1);
    private readonly arrowScale = new THREE.Vector3(1, 1, 1);
    private readonly carcassGeo = this.own(new THREE.IcosahedronGeometry(0.3, 0));
    private readonly carcassMat = this.own(new THREE.MeshStandardMaterial({ color: 0xd9a6a6, flatShading: true }));

    constructor(
        private readonly tilesWide: number,
        private readonly tilesHigh: number,
        private readonly heightAt: HeightFn,
    ) {
        this.group.add(this.sceneryGroup, this.animalGroup, this.destMarker, this.destLine, this.routeArrows);
        this.ringHolder.scale.setScalar(ANIMAL_SCALE);
        this.ringHolder.visible = false;
        this.ringHolder.add(this.ring);
        this.animalGroup.add(this.ringHolder);
        for (const o of [this.destMarker, this.destLine, this.routeArrows]) { o.visible = false; o.renderOrder = 11; o.frustumCulled = false; }
        this.routeArrows.count = 0;
        this.ring.rotation.x = -Math.PI / 2;
        this.ring.position.y = -0.19;
        this.ring.renderOrder = 10; // drawn over the ground so it is always visible
    }

    /** Highlights the animal with this id (null clears). The ring follows the animal and disappears if it dies. */
    setSelected(id: number | null): void {
        this.selectedId = id;
        const actor = id === null ? undefined : this.actors.get(id);
        this.ringHolder.visible = !!actor;
        this.selectedRow = null;
        this.selectedDest = null;
        this.selectedHeading = null;
        this.setRouteVisible(false);
        this.hideViewRange();
        const row = id === null ? undefined : this.lastRows.get(id);
        if (row) { this.selectedRow = row; this.showViewRange(row.x, row.y, row.range); }
    }

    /** Hides the view-range overlay. */
    private hideViewRange(): void {
        this.viewOverlay?.geometry.setDrawRange(0, 0);
    }

    /**
     * Marks every tile whose centre lies within the selected animal's view range (the same distance test the
     * simulation uses) with a translucent yellow layer, so the area it can see is visible on the map.
     */
    private showViewRange(x: number, y: number, range: number): void {
        const overlay = this.viewOverlay;
        if (!overlay || !range) { this.hideViewRange(); return; }
        const positions = overlay.geometry.getAttribute('position') as THREE.BufferAttribute;
        const capacity = positions.count / 4;
        const corner = new THREE.Vector3();
        const r2 = range * range;
        let n = 0;
        const x0 = Math.max(0, Math.floor(x - range)), x1 = Math.min(this.tilesWide - 1, Math.floor(x + range));
        const y0 = Math.max(0, Math.floor(y - range)), y1 = Math.min(this.tilesHigh - 1, Math.floor(y + range));
        for (let ty = y0; ty <= y1; ty++) {
            for (let tx = x0; tx <= x1; tx++) {
                const dx = tx + 0.5 - x, dy = ty + 0.5 - y;
                if (dx * dx + dy * dy > r2 || n >= capacity) continue;
                // Each tile's four corners sit on the terrain's own corner heights, so neighbouring tiles
                // share edges exactly and the layer follows slopes instead of stepping from tile to tile.
                for (let c = 0; c < 4; c++) {
                    this.place(tx + (c & 1), ty + (c >> 1), VIEW_LAYER_LIFT, corner);
                    positions.setXYZ(n * 4 + c, corner.x, corner.y, corner.z);
                }
                n++;
            }
        }
        positions.needsUpdate = true;
        overlay.geometry.setDrawRange(0, n * 6);
    }

    /** Writes the animal's current drawn (smoothed) world-space position into `out`; false if it is not alive. */
    getWorldPosition(id: number, out: THREE.Vector3): boolean {
        const actor = this.actors.get(id);
        if (!actor) return false;
        this.pose(actor, out);
        this.group.localToWorld(out);
        return true;
    }

    /** Id of the animal under the ray, or null. Uses generous invisible hit spheres so small animals are easy to click. */
    pick(raycaster: THREE.Raycaster): number | null {
        if (!this.animalGroup.visible) return null;
        this.group.updateWorldMatrix(true, false);
        this.pickRay.copy(raycaster.ray).applyMatrix4(this.pickInv.copy(this.group.matrixWorld).invert());
        let best: number | null = null;
        let bestDist = Infinity;
        for (const [id, actor] of this.actors) {
            this.pose(actor, this.tmpV);
            this.pickSphere.set(this.tmpV, PICK_RADIUS);
            if (!this.pickRay.intersectSphere(this.pickSphere, this.tmpV2)) continue;
            const d = this.tmpV2.distanceToSquared(this.pickRay.origin);
            if (d < bestDist) { bestDist = d; best = id; }
        }
        return best;
    }

    /**
     * Material for animals: standard lighting, but the position, heading and walking bob come from per-instance
     * attributes interpolated in the vertex shader (the same formula as [pose]), so no per-animal CPU work per frame.
     */
    private makeAnimalMaterial(): THREE.MeshStandardMaterial {
        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true, flatShading: true, emissive: new THREE.Color(0xffe9a8), emissiveIntensity: 0,
        });
        mat.onBeforeCompile = (shader) => {
            shader.uniforms.uNow = this.uNow;
            shader.uniforms.uScale = { value: ANIMAL_SCALE };
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', `#include <common>
attribute vec3 aFrom; attribute vec3 aTo; attribute vec4 aInfo; attribute float aSeed;
uniform float uNow; uniform float uScale;`)
                .replace('#include <beginnormal_vertex>', `float aK = clamp((uNow - aInfo.x) / aInfo.y, 0.0, 1.0);
float aHead = mix(aInfo.z, aInfo.w, aK);
float aC = cos(aHead); float aS = sin(aHead);
mat3 aRot = mat3(aC, 0.0, -aS, 0.0, 1.0, 0.0, aS, 0.0, aC);
vec3 objectNormal = aRot * vec3(normal);
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif`)
                .replace('#include <begin_vertex>', `float aMoving = (aK < 0.999 && distance(aFrom, aTo) > 0.001) ? 1.0 : 0.0;
float aBob = aMoving * abs(sin(uNow * 12.0 + aSeed)) * 0.05;
vec3 transformed = aRot * (position + vec3(0.0, aBob, 0.0)) * uScale + mix(aFrom, aTo, aK);`);
        };
        return mat;
    }

    /** The animal's drawn position right now (written to `out`) and heading (returned); mirrors the animal vertex shader. */
    private pose(a: Actor, out: THREE.Vector3): number {
        const k = Math.min(1, Math.max(0, (this.clockTime - a.t0) / a.dur));
        out.lerpVectors(a.from, a.target, k);
        return a.fromHeading + (a.targetHeading - a.fromHeading) * k;
    }

    private own<T extends { dispose(): void }>(resource: T): T {
        this.owned.push(resource);
        return resource;
    }

    /** Converts tile coordinates to a world-space position standing on the ground. */
    private place(tx: number, ty: number, lift = 0, out = new THREE.Vector3()): THREE.Vector3 {
        return out.set(tx - this.tilesWide / 2, this.heightAt(tx, ty) + lift, ty - this.tilesHigh / 2);
    }

    /** Makes animals glow softly: 0 = no glow (daytime), 1 = full glow (deep night). */
    setNightGlow(strength: number): void {
        this.animalMat.emissiveIntensity = NIGHT_GLOW_MAX * strength;
    }

    /** Shows or hides the animals (they are only meaningful while the simulation screen is open). */
    setAnimalsVisible(visible: boolean): void {
        this.animalGroup.visible = visible;
        if (this.viewOverlay) this.viewOverlay.visible = visible;
        if (!visible) this.setRouteVisible(false);
    }

    /** Builds the static scenery (trees and grass) as instanced meshes. Call once per simulation. */
    setInfo(info: SimInfo): void {
        this.actionNames = info.actions;
        this.animalGeos.forEach((g) => g.dispose());
        this.animalGeos.length = 0;
        for (const sp of info.species) this.animalGeos.push(buildAnimalGeometry(sp.canHunt ? CARNIVORE_COLOR : HERBIVORE_COLOR, sp.canHunt));
        this.animalGeos.push(buildAnimalGeometry(OTHER_COLOR, false));
        for (const b of this.batches) { this.animalGroup.remove(b.mesh); b.dispose(); }
        this.actors.clear();
        this.batches = this.animalGeos.map((g) => new AnimalBatch(g, this.animalMat));
        for (const b of this.batches) this.animalGroup.add(b.mesh);

        this.viewRanges = info.species.map((sp) => sp.viewRange);
        if (this.viewOverlay) {
            this.group.remove(this.viewOverlay);
            this.viewOverlay.geometry.dispose();
        }
        // Inherited view ranges can reach twice the founder value (AnimalStats.MAX_RATIO), so size for that.
        const widest = Math.ceil(Math.max(0, ...this.viewRanges) * 2);
        const capacity = (2 * widest + 2) ** 2;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 12), 3));
        const index: number[] = [];
        for (let i = 0; i < capacity; i++) index.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3);
        geo.setIndex(index);
        geo.setDrawRange(0, 0);
        this.viewOverlay = new THREE.Mesh(geo, this.viewTileMat);
        this.viewOverlay.frustumCulled = false;
        this.viewOverlay.renderOrder = 9;
        this.viewOverlay.visible = this.animalGroup.visible;
        this.group.add(this.viewOverlay);

        this.clearScenery();
        const trees = info.scenery.filter((s) => s[1] === 1);
        const grass = info.scenery.filter((s) => s[1] === 2);
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const pos = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);

        const trunk = new THREE.InstancedMesh(
            new THREE.CylinderGeometry(0.07, 0.1, 0.5, 5),
            new THREE.MeshStandardMaterial({ color: 0x8a5a33, flatShading: true }), trees.length);
        const foliage = new THREE.InstancedMesh(
            new THREE.ConeGeometry(0.4, 1.0, 6),
            new THREE.MeshStandardMaterial({ flatShading: true }), trees.length);
        trees.forEach(([id, , x, y], i) => {
            const s = TREE_SCALE * (0.8 + hash01(id) * 0.5);
            scale.set(s, s, s);
            q.setFromAxisAngle(up, hash01(id + 1) * Math.PI * 2);
            m.compose(this.place(x, y, 0.25 * s, pos), q, scale);
            trunk.setMatrixAt(i, m);
            m.compose(this.place(x, y, 0.95 * s, pos), q, scale);
            foliage.setMatrixAt(i, m);
            foliage.setColorAt(i, FOLIAGE_READY);
        });

        const tuft = new THREE.InstancedMesh(
            buildGrassGeometry(),
            new THREE.MeshStandardMaterial({ flatShading: true }), grass.length);
        grass.forEach(([id, , x, y], i) => {
            const s = 0.8 + hash01(id) * 0.6;
            scale.set(s, s, s);
            q.setFromAxisAngle(up, hash01(id + 3) * Math.PI * 2);
            m.compose(this.place(x, y, 0, pos), q, scale);
            tuft.setMatrixAt(i, m);
            tuft.setColorAt(i, GRASS_READY);
        });

        for (const mesh of [trunk, foliage, tuft]) {
            mesh.frustumCulled = false; // instance bounds are not tracked; the scene is small enough to always draw
            this.sceneryGroup.add(mesh);
        }
        this.foliage = foliage;
        this.grassMesh = tuft;
        this.lastTrees = '';
        this.lastGrass = '';
    }

    private clearScenery(): void {
        for (const child of [...this.sceneryGroup.children]) {
            this.sceneryGroup.remove(child);
            // Carcass meshes share one geometry/material (released with `owned`); only the instanced scenery owns its own.
            if (!(child instanceof THREE.InstancedMesh)) continue;
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
            child.dispose();
        }
        this.carcasses.clear();
        this.foliage = null;
        this.grassMesh = null;
    }

    /** Applies a new simulation snapshot: new animal targets, tree readiness and carcasses. */
    update(snap: SimSnapshot): void {
        const stamp = ++this.updateCount;
        const since = this.clockTime - this.lastUpdateClock;
        this.lastUpdateClock = this.clockTime;
        this.updateInterval = Math.min(0.4, Math.max(1 / 60, 0.7 * this.updateInterval + 0.3 * since));
        for (const row of snap.animals) {
            const id = row[A.id]!;
            let actor = this.actors.get(id);
            const target = this.place(row[A.x]!, row[A.y]!, 0.2 * ANIMAL_SCALE);
            if (!actor) {
                const batch = Math.min(row[A.species]!, this.batches.length - 1);
                actor = {
                    batch, slot: this.batches[batch]!.add(id), from: target.clone(), target: target.clone(), t0: this.clockTime - 10, dur: 1,
                    fromHeading: 0, targetHeading: 0, seen: stamp,
                    hp: row[A.hp]!, action: row[A.action]!, pendingDamage: 0, lastDamagePopup: -DAMAGE_POPUP_GAP,
                };
                this.writeActor(id, actor);
                this.actors.set(id, actor);
                if (id === this.selectedId) this.ringHolder.visible = true;
            } else {
                const dx = target.x - actor.target.x, dz = target.z - actor.target.z;
                if (dx * dx + dz * dz > 1e-12) {
                    // Glide on from wherever the animal is drawn right now, towards the new position.
                    const head = this.pose(actor, actor.from);
                    actor.t0 = this.clockTime;
                    actor.dur = this.updateInterval;
                    actor.fromHeading = head;
                    if (dx * dx + dz * dz > 1e-6) {
                        const want = Math.atan2(dx, dz);
                        actor.targetHeading = head + Math.atan2(Math.sin(want - head), Math.cos(want - head));
                    } else actor.targetHeading = head;
                    actor.target.copy(target);
                    this.writeActor(id, actor);
                }
                this.showEvents(actor, row[A.hp]!, row[A.action]!);
            }
            actor.seen = stamp;
            const x = row[A.x]!, y = row[A.y]!, range = row[A.viewRange]!;
            this.lastRows.set(id, { x, y, range });
            if (id === this.selectedId) {
                const tx = row[A.targetX]!, ty = row[A.targetY]!;
                this.selectedDest = tx < 0 ? null : { x: tx, y: ty };
                if (this.selectedDest) this.place(tx, ty, 0.08, this.destMarker.position);
                const actionName = this.actionNames[row[A.action]!] ?? '';
                this.selectedHeading = !this.selectedDest && row[A.heading]! !== NO_HEADING ? row[A.heading]! : null;
                this.applyRouteColor(ROUTE_COLORS[actionName] ?? HEADING_COLORS[actionName] ?? ROUTE_FALLBACK_COLOR);
                this.selectedWaypoints = this.selectedDest && this.pathProvider ? this.pathProvider(id) : [];
                this.setRouteVisible((this.selectedDest !== null || this.selectedHeading !== null) && this.animalGroup.visible);
                const prev = this.selectedRow;
                if (!prev || prev.x !== x || prev.y !== y || prev.range !== range) {
                    this.selectedRow = { x, y, range };
                    this.showViewRange(x, y, range);
                }
            }
        }
        for (const [id, actor] of this.actors) {
            if (actor.seen !== stamp) {
                if (id === this.selectedId) {
                    this.ringHolder.visible = false; this.selectedRow = null; this.selectedDest = null; this.selectedHeading = null;
                    this.setRouteVisible(false); this.hideViewRange();
                }
                const batch = this.batches[actor.batch]!;
                const moved = batch.remove(actor.slot);
                if (moved !== undefined) this.actors.get(moved)!.slot = actor.slot;
                this.actors.delete(id);
                this.lastRows.delete(id);
            }
        }

        if (snap.trees !== this.lastTrees && this.foliage) {
            for (let i = 0; i < snap.trees.length; i++) {
                this.foliage.setColorAt(i, snap.trees[i] === '1' ? FOLIAGE_READY : FOLIAGE_RESTING);
            }
            if (this.foliage.instanceColor) this.foliage.instanceColor.needsUpdate = true;
            this.lastTrees = snap.trees;
        }

        if (snap.grass !== this.lastGrass && this.grassMesh) {
            const prev = this.lastGrass;
            for (let i = 0; i < snap.grass.length; i++) {
                if (snap.grass[i] !== prev[i]) this.grassMesh.setColorAt(i, snap.grass[i] === '1' ? GRASS_READY : GRASS_RESTING);
            }
            if (this.grassMesh.instanceColor) this.grassMesh.instanceColor.needsUpdate = true;
            this.lastGrass = snap.grass;
        }

        for (const b of this.batches) b.flush();

        const live = new Set<number>();
        for (const [id, x, y, left] of snap.carcasses) {
            live.add(id);
            let mesh = this.carcasses.get(id);
            if (!mesh) {
                mesh = new THREE.Mesh(this.carcassGeo, this.carcassMat);
                this.sceneryGroup.add(mesh);
                this.carcasses.set(id, mesh);
            }
            this.place(x, y, 0.08, mesh.position);
            const s = 0.5 + 0.7 * left;
            mesh.scale.set(s, s * 0.45, s);
        }
        for (const [id, mesh] of this.carcasses) {
            if (!live.has(id)) { this.sceneryGroup.remove(mesh); this.carcasses.delete(id); }
        }
    }

    /** Spawns overhead text for damage taken and for a changed action since the previous snapshot. */
    private showEvents(actor: Actor, hp: number, action: number): void {
        if (hp < actor.hp) actor.pendingDamage += actor.hp - hp;
        actor.hp = hp;
        if (actor.pendingDamage > 0 && this.clockTime - actor.lastDamagePopup >= DAMAGE_POPUP_GAP) {
            this.pose(actor, this.tmpV);
            this.spawnPopup(`-${Math.max(1, Math.round(actor.pendingDamage))}`, DAMAGE_COLOR, this.tmpV);
            actor.pendingDamage = 0;
            actor.lastDamagePopup = this.clockTime;
        }
        if (action !== actor.action) {
            actor.action = action;
            const name = this.actionNames[action];
            if (name) { this.pose(actor, this.tmpV); this.spawnPopup(actionLabel(name), ACTION_COLOR, this.tmpV); }
        }
    }

    /** Text rendered once to a canvas and shared by every popup with the same text and colour. */
    private textTexture(text: string, color: string): THREE.CanvasTexture {
        const key = `${color}|${text}`;
        let tex = this.textures.get(key);
        if (!tex) {
            const canvas = document.createElement('canvas');
            canvas.width = 384;
            canvas.height = 96;
            const g = canvas.getContext('2d')!;
            g.font = 'bold 52px system-ui, sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.lineJoin = 'round';
            g.lineWidth = 10;
            g.strokeStyle = 'rgba(20, 24, 40, 0.9)';
            g.strokeText(text, canvas.width / 2, canvas.height / 2);
            g.fillStyle = color;
            g.fillText(text, canvas.width / 2, canvas.height / 2);
            tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            this.textures.set(key, tex);
        }
        return tex;
    }

    /** Pops [text] up above [at]; it rises and fades out, then removes itself. */
    private spawnPopup(text: string, color: string, at: THREE.Vector3): void {
        if (this.popups.length >= MAX_POPUPS) return;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.textTexture(text, color), transparent: true, depthTest: false,
        }));
        sprite.scale.set(POPUP_HEIGHT * 4, POPUP_HEIGHT, 1);
        sprite.renderOrder = 20; // above terrain, trees and animals
        const baseY = at.y + 1.1;
        sprite.position.set(at.x, baseY, at.z);
        this.animalGroup.add(sprite);
        this.popups.push({ sprite, age: 0, baseY });
    }

    private updatePopups(dt: number): void {
        for (let i = this.popups.length - 1; i >= 0; i--) {
            const p = this.popups[i]!;
            p.age += dt;
            const t = p.age / POPUP_LIFE;
            if (t >= 1) {
                this.animalGroup.remove(p.sprite);
                p.sprite.material.dispose();
                this.popups.splice(i, 1);
                continue;
            }
            p.sprite.position.y = p.baseY + POPUP_RISE * (1 - (1 - t) * (1 - t)); // eases out
            p.sprite.material.opacity = t < 0.5 ? 1 : 1 - (t - 0.5) * 2; // holds, then fades
        }
    }

    /** Writes an animal's interpolation state into its batch (called when it appears or its target changes). */
    private writeActor(id: number, a: Actor): void {
        this.batches[a.batch]!.write(a.slot, id, a.from, a.target, a.t0, a.dur, a.fromHeading, a.targetHeading);
    }

    /** Per-frame work: advance the shader clock and move the selection ring and route. Animals themselves move on the GPU. */
    animate(dt: number): void {
        this.clockTime += dt;
        if (this.clockTime > CLOCK_REBASE) this.rebaseClock();
        this.uNow.value = this.clockTime;
        this.updatePopups(dt);
        const sel = this.selectedId === null ? undefined : this.actors.get(this.selectedId);
        if (sel) {
            this.pose(sel, this.tmpV);
            this.ringHolder.position.copy(this.tmpV);
            if ((this.selectedDest || this.selectedHeading !== null) && this.destLine.visible) this.drawRoute(this.tmpV);
        }
    }

    /** Shifts every timestamp back by CLOCK_REBASE so the float32 values in the shader stay small and precise. */
    private rebaseClock(): void {
        this.clockTime -= CLOCK_REBASE;
        this.lastUpdateClock -= CLOCK_REBASE;
        for (const [id, a] of this.actors) {
            a.t0 -= CLOCK_REBASE;
            a.lastDamagePopup -= CLOCK_REBASE;
            this.writeActor(id, a);
        }
        for (const b of this.batches) b.flush();
    }

    /** Recolours the destination marker, route line and arrowheads. */
    private applyRouteColor(color: number): void {
        this.routeColor.set(color);
        for (const o of [this.destMarker, this.destLine, this.routeArrows]) {
            (o.material as THREE.MeshBasicMaterial | THREE.LineBasicMaterial).color.copy(this.routeColor);
        }
    }

    /** Sets the visibility of the destination marker, route line and arrowheads together. */
    private setRouteVisible(visible: boolean): void {
        this.destLine.visible = this.routeArrows.visible = visible;
        this.destMarker.visible = visible && this.selectedDest !== null;
    }

    /** Supplies the lookup for an animal's path waypoints (see KotlinSimulation.animalPath). */
    setPathProvider(provider: ((id: number) => number[]) | null): void {
        this.pathProvider = provider;
    }

    /**
     * Draws the selected animal's route: a line from [start] through its path waypoints to the destination,
     * with arrowheads at even spacing pointing along the direction of travel.
     */
    private drawRoute(start: THREE.Vector3): void {
        const pts = this.routePts;
        let n = 0;
        const next = (): THREE.Vector3 => (pts[n] ??= new THREE.Vector3());
        next().set(start.x, start.y + 0.1, start.z); n++;
        const wp = this.selectedWaypoints;
        for (let i = 0; i + 1 < wp.length && n < ROUTE_MAX_POINTS - 1; i += 2) {
            this.place(wp[i]!, wp[i + 1]!, 0.08, next()); n++;
        }
        if (this.selectedDest) {
            this.place(this.selectedDest.x, this.selectedDest.y, 0.08, next());
        } else {
            // No destination: a short arrow in the direction of travel (tile x/y map to world x/z).
            const end = next();
            const h = this.selectedHeading!;
            end.set(start.x + Math.cos(h) * HEADING_LENGTH, start.y + 0.1, start.z + Math.sin(h) * HEADING_LENGTH);
        }
        n++;

        const line = this.destLine.geometry;
        const pos = line.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < n; i++) pos.setXYZ(i, pts[i]!.x, pts[i]!.y, pts[i]!.z);
        pos.needsUpdate = true;
        line.setDrawRange(0, n);

        let arrows = 0;
        let d = ARROW_SPACING / 2;
        for (let i = 1; i < n && arrows < ARROW_MAX; i++) {
            const a = pts[i - 1]!, b = pts[i]!;
            this.arrowDir.subVectors(b, a);
            const len = this.arrowDir.length();
            if (len < 1e-6) continue;
            this.arrowDir.divideScalar(len);
            this.arrowQuat.setFromUnitVectors(this.arrowForward, this.arrowDir);
            while (d <= len && arrows < ARROW_MAX) {
                this.arrowPos.copy(a).addScaledVector(this.arrowDir, d);
                this.arrowMatrix.compose(this.arrowPos, this.arrowQuat, this.arrowScale);
                this.routeArrows.setMatrixAt(arrows++, this.arrowMatrix);
                d += ARROW_SPACING;
            }
            d -= len;
        }
        this.routeArrows.count = arrows;
        this.routeArrows.instanceMatrix.needsUpdate = true;
    }

    /** Releases everything this class created. */
    dispose(): void {
        for (const p of this.popups) p.sprite.material.dispose();
        this.popups.length = 0;
        this.textures.forEach((t) => t.dispose());
        this.textures.clear();
        this.clearScenery();
        this.viewOverlay?.geometry.dispose();
        this.routeArrows.dispose();
        this.batches.forEach((b) => b.dispose());
        this.animalGeos.forEach((g) => g.dispose());
        this.owned.forEach((r) => r.dispose());
    }
}
