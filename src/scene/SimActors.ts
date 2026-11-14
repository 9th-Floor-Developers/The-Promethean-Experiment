import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { A, type SimInfo, type SimSnapshot } from '../sim/types';

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
/** How quickly drawn animals catch up to the simulation (higher = snappier). */
const FOLLOW = 14;
const TURN = 12;

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

interface Actor {
    obj: THREE.Group;
    hp: number;
    action: number;
    /** Damage taken since the last damage popup. */
    pendingDamage: number;
    /** Value of the scene clock when the last damage popup was shown. */
    lastDamagePopup: number;
    target: THREE.Vector3;
    heading: number;
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

    /** One merged mesh geometry per species (body, head, ears and eyes baked together): one draw call per animal. */
    private readonly animalGeos: THREE.BufferGeometry[] = [];
    private readonly animalMat = this.own(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }));
    private readonly hitGeo = this.own(new THREE.SphereGeometry(0.7, 6, 4));
    private readonly hitMat = this.own(new THREE.MeshBasicMaterial({ visible: false }));
    private readonly ringGeo = this.own(new THREE.RingGeometry(0.42, 0.56, 24));
    private readonly ringMat = this.own(new THREE.MeshBasicMaterial({
        color: 0xffd23f, side: THREE.DoubleSide, depthTest: false, transparent: true,
    }));
    private readonly ring = new THREE.Mesh(this.ringGeo, this.ringMat);
    private selectedId: number | null = null;
    private readonly carcassGeo = this.own(new THREE.IcosahedronGeometry(0.3, 0));
    private readonly carcassMat = this.own(new THREE.MeshStandardMaterial({ color: 0xd9a6a6, flatShading: true }));

    constructor(
        private readonly tilesWide: number,
        private readonly tilesHigh: number,
        private readonly heightAt: HeightFn,
    ) {
        this.group.add(this.sceneryGroup, this.animalGroup);
        this.ring.rotation.x = -Math.PI / 2;
        this.ring.position.y = -0.19;
        this.ring.renderOrder = 10; // drawn over the ground so it is always visible
    }

    /** Highlights the animal with this id (null clears). The ring follows the animal and disappears if it dies. */
    setSelected(id: number | null): void {
        this.selectedId = id;
        this.ring.removeFromParent();
        const actor = id === null ? undefined : this.actors.get(id);
        if (actor) actor.obj.add(this.ring);
    }

    /** Writes the animal's current drawn (smoothed) world-space position into `out`; false if it is not alive. */
    getWorldPosition(id: number, out: THREE.Vector3): boolean {
        const actor = this.actors.get(id);
        if (!actor) return false;
        actor.obj.getWorldPosition(out);
        return true;
    }

    /** Id of the animal under the ray, or null. Uses generous invisible hit spheres so small animals are easy to click. */
    pick(raycaster: THREE.Raycaster): number | null {
        const hit = raycaster.intersectObjects(this.animalGroup.children, true)[0];
        for (let o: THREE.Object3D | null = hit?.object ?? null; o; o = o.parent) {
            const id = o.userData.animalId as number | undefined;
            if (id !== undefined) return id;
        }
        return null;
    }

    private own<T extends { dispose(): void }>(resource: T): T {
        this.owned.push(resource);
        return resource;
    }

    /** Converts tile coordinates to a world-space position standing on the ground. */
    private place(tx: number, ty: number, lift = 0, out = new THREE.Vector3()): THREE.Vector3 {
        return out.set(tx - this.tilesWide / 2, this.heightAt(tx, ty) + lift, ty - this.tilesHigh / 2);
    }

    /** Shows or hides the animals (they are only meaningful while the simulation screen is open). */
    setAnimalsVisible(visible: boolean): void {
        this.animalGroup.visible = visible;
    }

    /** Builds the static scenery (trees and grass) as instanced meshes. Call once per simulation. */
    setInfo(info: SimInfo): void {
        this.actionNames = info.actions;
        this.animalGeos.forEach((g) => g.dispose());
        this.animalGeos.length = 0;
        for (const sp of info.species) this.animalGeos.push(buildAnimalGeometry(sp.canHunt ? CARNIVORE_COLOR : HERBIVORE_COLOR, sp.canHunt));
        this.animalGeos.push(buildAnimalGeometry(OTHER_COLOR, false));

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
            const mesh = child as THREE.InstancedMesh;
            this.sceneryGroup.remove(mesh);
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
            mesh.dispose();
        }
        this.foliage = null;
        this.grassMesh = null;
    }

    /** Applies a new simulation snapshot: new animal targets, tree readiness and carcasses. */
    update(snap: SimSnapshot): void {
        const stamp = ++this.updateCount;
        for (const row of snap.animals) {
            const id = row[A.id]!;
            let actor = this.actors.get(id);
            const target = this.place(row[A.x]!, row[A.y]!, 0.2 * ANIMAL_SCALE);
            if (!actor) {
                actor = {
                    obj: this.buildAnimal(row[A.species]!), target: target.clone(), heading: 0, targetHeading: 0, seen: stamp,
                    hp: row[A.hp]!, action: row[A.action]!, pendingDamage: 0, lastDamagePopup: -DAMAGE_POPUP_GAP,
                };
                actor.obj.userData.animalId = id;
                actor.obj.position.copy(target);
                this.animalGroup.add(actor.obj);
                this.actors.set(id, actor);
                if (id === this.selectedId) actor.obj.add(this.ring);
            } else {
                const dx = target.x - actor.target.x, dz = target.z - actor.target.z;
                if (dx * dx + dz * dz > 1e-6) actor.targetHeading = Math.atan2(dx, dz);
                actor.target.copy(target);
                this.showEvents(actor, row[A.hp]!, row[A.action]!);
            }
            actor.seen = stamp;
        }
        for (const [id, actor] of this.actors) {
            if (actor.seen !== stamp) {
                if (id === this.selectedId) this.ring.removeFromParent();
                this.animalGroup.remove(actor.obj);
                this.actors.delete(id);
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
            this.spawnPopup(`-${Math.max(1, Math.round(actor.pendingDamage))}`, DAMAGE_COLOR, actor.obj.position);
            actor.pendingDamage = 0;
            actor.lastDamagePopup = this.clockTime;
        }
        if (action !== actor.action) {
            actor.action = action;
            const name = this.actionNames[action];
            if (name) this.spawnPopup(actionLabel(name), ACTION_COLOR, actor.obj.position);
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

    /** Per-frame smoothing between simulation ticks, plus a small walking bob. */
    animate(dt: number): void {
        this.clockTime += dt;
        this.updatePopups(dt);
        const follow = 1 - Math.exp(-dt * FOLLOW);
        const turn = 1 - Math.exp(-dt * TURN);
        for (const actor of this.actors.values()) {
            actor.obj.position.lerp(actor.target, follow);
            let d = actor.targetHeading - actor.heading;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            actor.heading += d * turn;
            actor.obj.rotation.y = actor.heading;
            const moving = actor.obj.position.distanceToSquared(actor.target) > 1e-4;
            const bob = moving ? Math.abs(Math.sin(this.clockTime * 12 + actor.obj.id)) * 0.05 : 0;
            actor.obj.children[0]!.position.y = bob;
        }
    }

    /** One animal facing +Z: a bobbing rig holding the merged body mesh, plus an invisible click target. */
    private buildAnimal(species: number): THREE.Group {
        const geo = this.animalGeos[Math.min(species, this.animalGeos.length - 1)]!;
        const root = new THREE.Group();
        const rig = new THREE.Group(); // bobs, so the root keeps the ground position
        rig.add(new THREE.Mesh(geo, this.animalMat));
        root.add(rig, new THREE.Mesh(this.hitGeo, this.hitMat));
        root.scale.setScalar(ANIMAL_SCALE);
        return root;
    }

    /** Releases everything this class created. */
    dispose(): void {
        for (const p of this.popups) p.sprite.material.dispose();
        this.popups.length = 0;
        this.textures.forEach((t) => t.dispose());
        this.textures.clear();
        this.clearScenery();
        this.animalGeos.forEach((g) => g.dispose());
        this.owned.forEach((r) => r.dispose());
    }
}
