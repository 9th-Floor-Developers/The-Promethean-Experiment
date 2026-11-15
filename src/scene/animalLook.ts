/**
 * Random, fictional, cute animal looks. A look is a single 32-bit seed saved with each species; the same seed always
 * builds the same low-poly model (body, legs, head, eyes, ears, tail, back decoration, nose and colours).
 *
 * Looks deliberately have nothing to do with a species' stats, diet or any real animal. When a new look is picked,
 * [pickDistinctLook] tries many seeds and keeps the one most different (colour first, then shape) from the other
 * species, so every species on the island is easy to tell apart. Colours avoid the terrain's greens, yellows and
 * water blues so animals never blend into the ground.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** A species' look: a 32-bit unsigned seed. */
export type Look = number;

/** Body plan options. Each index is one visually different variant. */
const BODY_SHAPES = ['gem', 'pebble', 'diamond', 'ball'] as const;
const EARS = ['none', 'pointed', 'bunny', 'round', 'floppy', 'antennae', 'horns', 'unicorn'] as const;
const TAILS = ['none', 'pompom', 'spike', 'whip', 'fan'] as const;
const BACKS = ['none', 'spikes', 'spots', 'crest', 'shell'] as const;
const EYES = ['big', 'small', 'cyclops'] as const;
const NOSES = ['none', 'button', 'snout'] as const;
const HEAD_PLACES = ['front', 'top'] as const;
/** Leg length in model units; 0 = a legless blob that slides along the ground. */
const LEG_LENGTHS = [0, 0.07, 0.15] as const;

/** Hue ranges (degrees) animals may use: reds, oranges, pinks, magentas, purples and indigos; never terrain colours. */
const HUE_RANGES: [number, number][] = [[218, 360], [0, 28]];

/** Everything that defines how one look is drawn; derived from the seed by [describeLook]. */
export interface LookSpec {
    body: (typeof BODY_SHAPES)[number];
    /** Body stretch on x (width), y (height), z (length). */
    bodyScale: [number, number, number];
    legLength: number;
    headPlace: (typeof HEAD_PLACES)[number];
    headShape: (typeof BODY_SHAPES)[number];
    headSize: number;
    eyes: (typeof EYES)[number];
    ears: (typeof EARS)[number];
    tail: (typeof TAILS)[number];
    back: (typeof BACKS)[number];
    nose: (typeof NOSES)[number];
    belly: boolean;
    blush: boolean;
    /** Main body colour, a lighter/different secondary colour (belly, spots) and an accent colour (ears, tail, horns). */
    primary: THREE.Color;
    secondary: THREE.Color;
    accent: THREE.Color;
}

/** Small fast seeded PRNG (mulberry32) returning 0..1. */
function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Picks one item of a list using the random source. */
function pick<T>(r: () => number, items: readonly T[]): T {
    return items[Math.floor(r() * items.length) % items.length]!;
}

/** A random hue (degrees) inside [HUE_RANGES], chosen in proportion to each range's width. */
function allowedHue(r: () => number): number {
    const total = HUE_RANGES.reduce((s, [a, b]) => s + (b - a), 0);
    let x = r() * total;
    for (const [a, b] of HUE_RANGES) {
        if (x < b - a) return (a + x) % 360;
        x -= b - a;
    }
    return HUE_RANGES[0]![0];
}

/** Colour from HSL in degrees / 0..1, in three's working (linear) colour space. */
function hsl(h: number, s: number, l: number): THREE.Color {
    return new THREE.Color().setHSL(((h % 360) + 360) % 360 / 360, s, l, THREE.SRGBColorSpace);
}

/** Decodes a seed into its full look description. Deterministic: the same seed always gives the same spec. */
export function describeLook(seed: Look): LookSpec {
    const r = rng(seed);
    const hue = allowedHue(r);
    const primary = hsl(hue, 0.5 + r() * 0.4, 0.56 + r() * 0.2);
    const secondary = r() < 0.5 ? hsl(hue, 0.35 + r() * 0.3, 0.84 + r() * 0.08) : hsl(allowedHue(r), 0.55 + r() * 0.3, 0.7 + r() * 0.12);
    const accent = hsl(allowedHue(r), 0.6 + r() * 0.35, 0.5 + r() * 0.2);
    return {
        body: pick(r, BODY_SHAPES),
        bodyScale: [0.85 + r() * 0.4, 0.75 + r() * 0.4, 0.95 + r() * 0.5],
        legLength: pick(r, LEG_LENGTHS),
        headPlace: pick(r, HEAD_PLACES),
        headShape: pick(r, BODY_SHAPES),
        headSize: 0.15 + r() * 0.07,
        eyes: pick(r, EYES),
        ears: pick(r, EARS),
        tail: pick(r, TAILS),
        back: pick(r, BACKS),
        nose: pick(r, NOSES),
        belly: r() < 0.5,
        blush: r() < 0.55,
        primary, secondary, accent,
    };
}

/** A low-poly base shape of the given radius for a body or head. */
function shapeGeometry(shape: LookSpec['body'], radius: number): THREE.BufferGeometry {
    switch (shape) {
        case 'gem': return new THREE.IcosahedronGeometry(radius, 0);
        case 'pebble': return new THREE.DodecahedronGeometry(radius, 0);
        case 'diamond': return new THREE.OctahedronGeometry(radius * 1.1, 0);
        case 'ball': return new THREE.SphereGeometry(radius, 7, 5);
    }
}

/**
 * Builds the model for a look as one merged, vertex-coloured geometry facing +Z, with its feet at y = -0.2
 * (where the scene expects the ground) and roughly the same size as before, so selection and the ring still fit.
 */
export function buildLookGeometry(seed: Look): THREE.BufferGeometry {
    const s = describeLook(seed);
    const parts: THREE.BufferGeometry[] = [];
    const euler = new THREE.Euler();
    const quat = new THREE.Quaternion();
    /** Adds one coloured part: scaled, then rotated (x, y, z radians), then moved. */
    const part = (geo: THREE.BufferGeometry, color: THREE.Color, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], rot: [number, number, number] = [0, 0, 0]) => {
        const g = geo.index ? geo.toNonIndexed() : geo; // merging needs every part indexed or none
        if (g !== geo) geo.dispose();
        g.deleteAttribute('uv'); // not every primitive has the same attributes; only position/normal/color are needed
        g.scale(...scale);
        g.applyQuaternion(quat.setFromEuler(euler.set(...rot)));
        g.translate(...pos);
        const colors = new Float32Array(g.attributes.position!.count * 3);
        for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        parts.push(g);
    };
    const black = new THREE.Color(0x1d1d24);
    const white = new THREE.Color(0xffffff);
    const pink = hsl(345, 0.85, 0.78);

    // Body, standing on its legs (or resting on the ground when legless).
    const R = 0.26;
    const [sx, sy, sz] = s.bodyScale;
    const halfH = R * sy * 0.9;
    const by = -0.2 + s.legLength + halfH;
    part(shapeGeometry(s.body, R), s.primary, [0, by, 0], [sx, sy, sz]);
    if (s.belly) part(new THREE.SphereGeometry(R * 0.8, 6, 4), s.secondary, [0, by - halfH * 0.35, R * sz * 0.1], [sx * 0.85, sy * 0.6, sz * 0.85]);

    // Legs: four stubby cones under the body corners.
    if (s.legLength > 0) {
        for (const lx of [-1, 1]) for (const lz of [-1, 1]) {
            part(new THREE.CylinderGeometry(0.045, 0.06, s.legLength + 0.06, 5), s.primary,
                [lx * R * sx * 0.5, -0.2 + (s.legLength + 0.06) / 2, lz * R * sz * 0.55]);
        }
    }

    // Head: in front of the body, or perched on top of it.
    const hr = s.headSize;
    const head: [number, number, number] = s.headPlace === 'front'
        ? [0, by + halfH * 0.55, R * sz * 0.85]
        : [0, by + halfH + hr * 0.55, R * sz * 0.4];
    part(shapeGeometry(s.headShape, hr), s.primary, head);
    const [hx, hy, hz] = head;
    const face = hz + hr * 0.88;

    // Eyes (with a tiny white sparkle each, for the cute look).
    const eye = (x: number, size: number) => {
        part(new THREE.SphereGeometry(size, 6, 5), black, [hx + x, hy + hr * 0.15, face - size * 0.4]);
        part(new THREE.SphereGeometry(size * 0.35, 4, 3), white, [hx + x + size * 0.3, hy + hr * 0.15 + size * 0.4, face + size * 0.3]);
    };
    if (s.eyes === 'cyclops') eye(0, 0.065);
    else for (const side of [-1, 1]) eye(side * hr * 0.42, s.eyes === 'big' ? 0.048 : 0.033);
    if (s.blush) for (const side of [-1, 1]) part(new THREE.SphereGeometry(0.03, 5, 3), pink, [hx + side * hr * 0.62, hy - hr * 0.2, face - 0.04], [1, 0.6, 0.4]);

    // Nose.
    if (s.nose === 'button') part(new THREE.SphereGeometry(0.03, 5, 4), s.accent, [hx, hy - hr * 0.15, face + 0.01]);
    if (s.nose === 'snout') part(new THREE.CylinderGeometry(hr * 0.35, hr * 0.45, hr * 0.6, 6), s.secondary, [hx, hy - hr * 0.3, face + hr * 0.05], [1, 1, 1], [Math.PI / 2, 0, 0]);

    // Ears, horns or antennae on top of the head.
    const top = hy + hr * 0.8;
    for (const side of [-1, 1]) {
        const ex = hx + side * hr * 0.5;
        switch (s.ears) {
            case 'pointed': part(new THREE.ConeGeometry(0.06, 0.16, 4), s.primary, [ex, top + 0.04, hz], [1, 1, 1], [0, 0, -side * 0.25]); break;
            case 'bunny': part(new THREE.ConeGeometry(0.055, 0.3, 5), s.accent, [ex * 0.8, top + 0.12, hz - 0.03], [1, 1, 0.6], [-0.2, 0, -side * 0.12]); break;
            case 'round': part(new THREE.SphereGeometry(0.065, 6, 4), s.accent, [ex, top + 0.01, hz], [1, 1, 0.5]); break;
            case 'floppy': part(new THREE.SphereGeometry(0.06, 6, 4), s.accent, [hx + side * hr * 0.95, hy + hr * 0.2, hz], [0.5, 1.6, 0.9], [0, 0, side * 0.5]); break;
            case 'antennae':
                part(new THREE.CylinderGeometry(0.01, 0.012, 0.18, 4), black, [ex * 0.7, top + 0.07, hz], [1, 1, 1], [0, 0, -side * 0.35]);
                part(new THREE.SphereGeometry(0.035, 5, 4), s.accent, [hx + side * (hr * 0.35 + 0.06), top + 0.16, hz]);
                break;
            case 'horns': part(new THREE.ConeGeometry(0.035, 0.15, 5), s.accent, [hx + side * hr * 0.75, top, hz], [1, 1, 1], [0.3, 0, -side * 0.9]); break;
        }
    }
    if (s.ears === 'unicorn') part(new THREE.ConeGeometry(0.035, 0.2, 5), s.accent, [hx, top + 0.02, hz + hr * 0.45], [1, 1, 1], [0.6, 0, 0]);

    // Tail at the back of the body.
    const back = -R * sz * 0.9;
    switch (s.tail) {
        case 'pompom': part(new THREE.IcosahedronGeometry(0.07, 0), s.secondary, [0, by + halfH * 0.3, back]); break;
        case 'spike': part(new THREE.ConeGeometry(0.06, 0.2, 5), s.accent, [0, by + halfH * 0.3, back - 0.06], [1, 1, 1], [-Math.PI / 2 - 0.5, 0, 0]); break;
        case 'whip':
            part(new THREE.CylinderGeometry(0.015, 0.025, 0.28, 4), s.primary, [0, by + halfH * 0.6, back - 0.08], [1, 1, 1], [-0.7, 0, 0]);
            part(new THREE.SphereGeometry(0.04, 5, 4), s.accent, [0, by + halfH * 0.6 + 0.11, back - 0.17]);
            break;
        case 'fan': part(new THREE.SphereGeometry(0.11, 6, 4), s.accent, [0, by + halfH * 0.8, back - 0.02], [1.1, 1, 0.25], [-0.4, 0, 0]); break;
    }

    // Decoration along the back.
    const ridge = by + halfH;
    switch (s.back) {
        case 'spikes':
            for (const k of [-0.5, 0, 0.5]) part(new THREE.ConeGeometry(0.035, 0.1, 4), s.accent, [0, ridge + 0.02, k * R * sz * 0.8]);
            break;
        case 'spots':
            for (const [x, z] of [[-0.6, 0.3], [0.55, -0.1], [-0.2, -0.5], [0.3, 0.55]] as const) {
                part(new THREE.SphereGeometry(0.045, 5, 3), s.secondary, [x * R * sx * 0.6, ridge - 0.025, z * R * sz * 0.7], [1, 0.4, 1]);
            }
            break;
        case 'crest': part(new THREE.ConeGeometry(0.1, 0.14, 4), s.accent, [0, ridge + 0.03, 0], [0.3, 1, 1.6]); break;
        case 'shell': part(new THREE.DodecahedronGeometry(R * 0.85, 0), s.secondary, [0, by + halfH * 0.35, -R * sz * 0.05], [sx * 0.95, sy * 0.75, sz * 0.9]); break;
    }

    const merged = mergeGeometries(parts)!;
    parts.forEach((g) => g.dispose());

    // Tall combinations (long legs + head on top + bunny ears) are shrunk evenly towards the feet so every species
    // stays about the same size as the others and fits the selection ring.
    merged.computeBoundingBox();
    const height = merged.boundingBox!.max.y - FEET_Y;
    if (height > MAX_HEIGHT) {
        const k = MAX_HEIGHT / height;
        merged.translate(0, -FEET_Y, 0).scale(k, k, k).translate(0, FEET_Y, 0);
        merged.computeBoundingBox();
    }
    return merged;
}

/** Model-space height of the feet (the scene places this on the ground) and the tallest a model may be above them. */
const FEET_Y = -0.2;
const MAX_HEIGHT = 0.85;

/** Perceptual (OKLab) coordinates of a linear-space colour, for comparing how different two colours look. */
function oklab(c: THREE.Color): [number, number, number] {
    const l = Math.cbrt(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b);
    const m = Math.cbrt(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b);
    const s = Math.cbrt(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b);
    return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
}

/**
 * How different two looks appear: perceptual distance of the main colours (dominant), plus a little for each
 * differing body feature. Larger is more different.
 */
export function lookDistance(a: Look, b: Look): number {
    const x = describeLook(a), y = describeLook(b);
    const [l1, a1, b1] = oklab(x.primary), [l2, a2, b2] = oklab(y.primary);
    const colour = Math.hypot(l1 - l2, a1 - a2, b1 - b2);
    const keys = ['body', 'legLength', 'headPlace', 'eyes', 'ears', 'tail', 'back', 'nose'] as const;
    const shape = keys.filter((k) => x[k] !== y[k]).length;
    return colour * 4 + shape * 0.08;
}

/** A fresh random seed from the browser's random source. */
function randomSeed(): Look {
    return (Math.random() * 4294967296) >>> 0;
}

/**
 * Picks a new look that is as different as possible from `others` (the other species' looks): tries many random
 * seeds and keeps the one whose closest neighbour is furthest away. `random` makes the choice deterministic.
 */
export function pickDistinctLook(others: readonly Look[], random: () => number = Math.random): Look {
    const candidate = () => (random === Math.random ? randomSeed() : (random() * 4294967296) >>> 0);
    if (others.length === 0) return candidate();
    let best = candidate();
    let bestScore = -1;
    for (let i = 0; i < 80; i++) {
        const seed = i === 0 ? best : candidate();
        const score = Math.min(...others.map((o) => lookDistance(seed, o)));
        if (score > bestScore) { bestScore = score; best = seed; }
    }
    return best;
}

/** Simple string hash (FNV-1a) used to give built-in species a fixed look from their name. */
function hashString(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return h >>> 0;
}

/**
 * Gives every species without a valid look one that is distinct from the looks before it. The choice is seeded by
 * the species' name and position, so built-in presets (and older saves) always get the same looks.
 */
export function fillMissingLooks<T extends { name: string; look?: unknown }>(species: T[]): (T & { look: Look })[] {
    const out: (T & { look: Look })[] = [];
    species.forEach((sp, i) => {
        const valid = typeof sp.look === 'number' && Number.isFinite(sp.look);
        const look = valid ? (sp.look as number) >>> 0 : pickDistinctLook(out.map((o) => o.look), rng(hashString(sp.name) ^ Math.imul(i + 1, 0x9e3779b1)));
        out.push({ ...sp, look });
    });
    return out;
}

/** Radius of the plain sphere drawn for an animal when "Show animals as spheres" is on. */
const SPHERE_RADIUS = 0.3;

/**
 * A plain low-poly sphere in the species' main colour, resting on the ground (y = -0.2, the same ground line the
 * detailed models stand on). Used instead of [buildLookGeometry] when the "Show animals as spheres" display setting is on.
 */
export function buildSphereGeometry(seed: Look): THREE.BufferGeometry {
    const g = new THREE.IcosahedronGeometry(SPHERE_RADIUS, 1);
    g.deleteAttribute('uv');
    g.translate(0, -0.2 + SPHERE_RADIUS, 0);
    const color = describeLook(seed).primary;
    const colors = new Float32Array(g.attributes.position!.count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
}
