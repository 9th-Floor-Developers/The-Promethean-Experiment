import * as THREE from 'three';
import type { TerrainData } from './types';

/** World units per tile. The island is `width x height` units on the XZ plane, centered on the origin. */
const TILE_SIZE = 1;

/** Y of the sea floor under water tiles and of the water surface; the skirt's bottom is BASE_Y. */
export const SEABED_Y = -1.2;
export const WATER_Y = -0.35;
const BASE_Y = SEABED_Y; // skirt stops at sea-floor level: anything lower would show through the water as a line

/** Per-tile-type look. Keyed by the Kotlin `TileType` enum name; `height` is the base land elevation. */
export const SEABED_COLOR = 0x3fb0c9;

const TILE_STYLE: Record<string, { color: number; height: number }> = {
    PLAIN: { color: 0x7ed957, height: 0.5 },
    FOREST: { color: 0x2f9e5b, height: 0.9 },
    DESERT: { color: 0xf2c75c, height: 0.35 },
    WATER: { color: SEABED_COLOR, height: SEABED_Y }, // seabed colour, seen through the water volume
};
const FALLBACK_STYLE = { color: 0xcc66cc, height: 0.5 };
const BEACH_COLOR = 0xf7e7a6;
const EARTH_COLOR = 0x9c6b45;
/** Shared with WorldScene's open-ocean layers so the island's water and the surrounding sea are one seamless surface. */
export const WATER_COLOR = 0x4fb7ff;
export const WATER_OPACITY = 0.6;

/** Deterministic pseudo-random 0..1 from an integer, so the island looks identical every run. */
function hash01(n: number): number {
    let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/**
 * Builds the miniature island from Kotlin-generated terrain data.
 * Contract: returns one Object3D centered on the origin; WorldScene owns disposal of
 * its geometries/materials. With `terrain === null` (data still loading) a small
 * placeholder island is returned so the scene is never empty.
 *
 * Kotlin supplies only tile types (no elevation), so elevation is derived here
 * deterministically: base height per type + a gentle rise with distance from the
 * shore + small per-tile jitter. Shape and tile layout are untouched.
 */
export function buildTerrainObject(terrain: TerrainData | null): THREE.Object3D {
    return terrain ? buildIsland(terrain) : buildPlaceholder();
}

/**
 * Per-corner land elevation for the whole island: `vertH[vy * vw + vx]` is the height of tile corner (vx, vy),
 * with `vw = width + 1`; `dist` is each tile's distance from water (for the beach). Shared by the island mesh and by anything that must stand on the ground.
 */
function computeVertexHeights(t: TerrainData): { vertH: Float32Array; vw: number; dist: Int16Array } {
    const { width: w, height: h } = t;
    const isLand = (i: number) => t.tileTypes[t.tiles[i]!]?.walkable ?? false;
    const nameOf = (i: number) => t.tileTypes[t.tiles[i]!]?.name ?? '';

    // Distance (in tiles, 4-connected) from the nearest water tile, via multi-source BFS.
    const dist = new Int16Array(w * h).fill(-1);
    const queue: number[] = [];
    for (let i = 0; i < w * h; i++) if (!isLand(i)) { dist[i] = 0; queue.push(i); }
    for (let q = 0; q < queue.length; q++) {
        const i = queue[q]!;
        const x = i % w, y = (i - x) / w;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const n = ny * w + nx;
            if (dist[n] === -1) { dist[n] = dist[i]! + 1; queue.push(n); }
        }
    }

    // Per-tile elevation.
    const tileH = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        const style = TILE_STYLE[nameOf(i)] ?? FALLBACK_STYLE;
        tileH[i] = isLand(i)
            ? style.height + Math.min(dist[i]! - 1, 5) * 0.28 + (hash01(i) - 0.5) * 0.3
            : SEABED_Y;
    }

    // Per-vertex elevation: mean of the (up to 4) tiles touching the corner, which smooths slopes.
    const vw = w + 1;
    const vertH = new Float32Array(vw * (h + 1));
    for (let vy = 0; vy <= h; vy++) for (let vx = 0; vx <= w; vx++) {
        let sum = 0, n = 0;
        for (const [tx, ty] of [[vx - 1, vy - 1], [vx, vy - 1], [vx - 1, vy], [vx, vy]] as const) {
            if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
            sum += tileH[ty * w + tx]!; n++;
        }
        vertH[vy * vw + vx] = sum / n;
    }

    return { vertH, vw, dist };
}

/**
 * Returns a function giving the ground height at continuous tile coordinates (tx, ty), where the tile under
 * a point is (floor(tx), floor(ty)) like the Kotlin simulation. Bilinear between the island's corner heights.
 */
export function createHeightSampler(t: TerrainData): (tx: number, ty: number) => number {
    const { vertH, vw } = computeVertexHeights(t);
    const w = t.width, h = t.height;
    return (tx, ty) => {
        const x = Math.min(Math.max(tx, 0), w), y = Math.min(Math.max(ty, 0), h);
        const x0 = Math.min(Math.floor(x), w - 1), y0 = Math.min(Math.floor(y), h - 1);
        const fx = x - x0, fy = y - y0;
        const h00 = vertH[y0 * vw + x0]!, h10 = vertH[y0 * vw + x0 + 1]!;
        const h01 = vertH[(y0 + 1) * vw + x0]!, h11 = vertH[(y0 + 1) * vw + x0 + 1]!;
        return (h00 * (1 - fx) + h10 * fx) * (1 - fy) + (h01 * (1 - fx) + h11 * fx) * fy;
    };
}

function buildIsland(t: TerrainData): THREE.Object3D {
    const { width: w, height: h } = t;
    const isLand = (i: number) => t.tileTypes[t.tiles[i]!]?.walkable ?? false;
    const nameOf = (i: number) => t.tileTypes[t.tiles[i]!]?.name ?? '';
    const { vertH, vw, dist } = computeVertexHeights(t);

    const x0 = -(w * TILE_SIZE) / 2;
    const z0 = -(h * TILE_SIZE) / 2;
    const px = (vx: number) => x0 + vx * TILE_SIZE;
    const pz = (vy: number) => z0 + vy * TILE_SIZE;

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const color = new THREE.Color();

    // Top surface: one shared vertex per tile corner, so normals and colours are continuous across tiles.
    // A corner's colour is the mean of the land tiles touching it (so shores stay sandy rather than turning
    // turquoise), or the seabed colour when only water touches it. Land corners get a small brightness jitter.
    const tileColor = (i: number) => (isLand(i) && dist[i] === 1 ? BEACH_COLOR : (TILE_STYLE[nameOf(i)] ?? FALLBACK_STYLE).color);
    const acc = new THREE.Color();
    for (let vy = 0; vy <= h; vy++) for (let vx = 0; vx <= w; vx++) {
        acc.setRGB(0, 0, 0);
        let landTiles = 0;
        for (const [tx, ty] of [[vx - 1, vy - 1], [vx, vy - 1], [vx - 1, vy], [vx, vy]] as const) {
            if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
            const i = ty * w + tx;
            if (!isLand(i)) continue;
            color.set(tileColor(i));
            acc.r += color.r; acc.g += color.g; acc.b += color.b;
            landTiles++;
        }
        if (landTiles > 0) {
            acc.multiplyScalar(1 / landTiles);
            // Seabed gets no brightness jitter so it blends seamlessly into WorldScene's surrounding sea floor.
            acc.multiplyScalar(0.94 + hash01(vy * vw + vx) * 0.12);
        } else {
            acc.set(SEABED_COLOR);
        }
        positions.push(px(vx), vertH[vy * vw + vx]!, pz(vy));
        colors.push(acc.r, acc.g, acc.b);
    }
    // Two triangles per tile; the diagonal alternates in a checkerboard so shading has no directional bias.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const a = y * vw + x, b = a + 1, c = a + vw, d = c + 1;
        if ((x + y) % 2 === 0) indices.push(a, c, b, b, c, d);
        else indices.push(a, c, d, a, d, b);
    }

    // Diorama skirt: earth walls from the island's edge down to BASE_Y, giving a visible boundary.
    // Each wall quad has its own vertices, so the walls stay flat-shaded and do not smooth into the top surface.
    const earth = new THREE.Color(EARTH_COLOR);
    const wall = (ax: number, ay: number, bx: number, by: number) => {
        const base = positions.length / 3;
        positions.push(
            px(ax), vertH[ay * vw + ax]!, pz(ay),
            px(bx), vertH[by * vw + bx]!, pz(by),
            px(ax), BASE_Y, pz(ay),
            px(bx), BASE_Y, pz(by),
        );
        for (let k = 0; k < 4; k++) colors.push(earth.r, earth.g, earth.b);
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    };
    for (let x = 0; x < w; x++) {
        wall(x + 1, 0, x, 0); // north edge
        wall(x, h, x + 1, h); // south edge
    }
    for (let y = 0; y < h; y++) {
        wall(0, y, 0, y + 1); // west edge
        wall(w, y + 1, w, y); // east edge
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const land = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, side: THREE.DoubleSide }),
    );

    // Water is NOT part of the island: WorldScene draws one ocean surface over island and sea alike (no seam).
    const group = new THREE.Group();
    group.add(land);
    return group;
}

/** Temporary stand-in shown until the Kotlin terrain finishes loading. */
function buildPlaceholder(): THREE.Object3D {
    const group = new THREE.Group();
    const island = new THREE.Mesh(
        new THREE.CylinderGeometry(36, 42, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x7ed957, flatShading: true }),
    );
    const sea = new THREE.Mesh(
        new THREE.CylinderGeometry(80, 80, 2, 24),
        new THREE.MeshStandardMaterial({ color: 0x4fb7ff, flatShading: true }),
    );
    sea.position.y = -2;
    group.add(sea, island);
    return group;
}
