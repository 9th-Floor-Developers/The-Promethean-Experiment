import { A, type SimInfo, type SimSnapshot } from '../sim/types';
import { AnimalPortrait } from './AnimalPortrait';

/** The user's leaderboard choices. Owned by a parent that outlives the leaderboard, so they survive selecting an animal. */
export interface LeaderboardSettings {
    /** Key of the stat ranked by (see STATS). */
    statKey: string;
    /** Key of the species filter ('all', 'herb', 'carn' or 'sp:<index>'). */
    filterKey: string;
    /** True = highest first. */
    descending: boolean;
}

/** Defaults used when the app starts. */
export const DEFAULT_LEADERBOARD_SETTINGS: LeaderboardSettings = { statKey: 'hp', filterKey: 'all', descending: true };

interface Props {
    settings: LeaderboardSettings;
    onSettingsChange: (settings: LeaderboardSettings) => void;
    snapshot: SimSnapshot | null;
    info: SimInfo | null;
    onSelect: (id: number) => void;
}

/** A stat every species has, with the snapshot column it is read from and how it is shown. */
interface Stat {
    key: string;
    label: string;
    column: number;
    format: (v: number) => string;
}

/** Rankable stats. Every species has all of them, so they work for any species mix. */
const STATS: Stat[] = [
    { key: 'hp', label: 'Health', column: A.hp, format: (v) => Math.round(v).toString() },
    { key: 'age', label: 'Age', column: A.age, format: (v) => `${v.toFixed(2)} d` },
    { key: 'stamina', label: 'Stamina', column: A.stamina, format: (v) => Math.round(v).toString() },
    { key: 'nutrition', label: 'Nutrition', column: A.nutrition, format: (v) => Math.round(v).toString() },
    { key: 'hydration', label: 'Hydration', column: A.hydration, format: (v) => Math.round(v).toString() },
    { key: 'hunger', label: 'Hunger', column: A.hunger, format: (v) => v.toFixed(2) },
    { key: 'thirst', label: 'Thirst', column: A.thirst, format: (v) => v.toFixed(2) },
    { key: 'fear', label: 'Fear', column: A.fear, format: (v) => v.toFixed(2) },
    { key: 'libido', label: 'Libido', column: A.libido, format: (v) => v.toFixed(2) },
];

/** How many ranked animals are shown (each has a live portrait). */
const ROWS = 10;

/** A species filter choice: either a group (herbivores / carnivores) or one species. */
interface Filter {
    key: string;
    label: string;
    matches: (speciesIndex: number) => boolean;
}

/** Builds filters from the species list: All, Herbivores, Carnivores (only if present), then each individual species. */
function buildFilters(info: SimInfo): Filter[] {
    const filters: Filter[] = [{ key: 'all', label: 'All species', matches: () => true }];
    if (info.species.some((s) => !s.canHunt)) filters.push({ key: 'herb', label: 'Herbivores', matches: (i) => !info.species[i]!.canHunt });
    if (info.species.some((s) => s.canHunt)) filters.push({ key: 'carn', label: 'Carnivores', matches: (i) => info.species[i]!.canHunt });
    info.species.forEach((s, idx) => filters.push({ key: `sp:${idx}`, label: s.name, matches: (i) => i === idx }));
    return filters;
}

/**
 * Ranked list of living animals by a chosen stat, filterable by species group or species.
 * Each row shows a live portrait of the animal and its value; clicking a row selects it in the inspector.
 */
export function Leaderboard({ settings, onSettingsChange, snapshot, info, onSelect }: Props) {
    const { statKey, filterKey, descending } = settings;

    if (!snapshot || !info) return <div className="panel__empty">No data yet.</div>;

    const stat = STATS.find((s) => s.key === statKey)!;
    const filters = buildFilters(info);
    const filter = filters.find((f) => f.key === filterKey) ?? filters[0]!;
    const rows = snapshot.animals
        .filter((r) => filter.matches(r[A.species]!))
        .sort((a, b) => (descending ? b[stat.column]! - a[stat.column]! : a[stat.column]! - b[stat.column]!))
        .slice(0, ROWS);

    return (
        <div className="leaderboard">
            <div className="leaderboard__controls">
                <label>
                    Rank by
                    <select value={statKey} onChange={(e) => onSettingsChange({ ...settings, statKey: e.target.value })}>
                        {STATS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                </label>
                <label>
                    Show
                    <select value={filter.key} onChange={(e) => onSettingsChange({ ...settings, filterKey: e.target.value })}>
                        {filters.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                </label>
                <button type="button" onClick={() => onSettingsChange({ ...settings, descending: !descending })} title="Reverse the order">
                    {descending ? 'Highest ▼' : 'Lowest ▲'}
                </button>
            </div>
            {rows.length === 0 ? (
                <div className="panel__empty">No animals match.</div>
            ) : (
                <ol className="leaderboard__list">
                    {rows.map((r, i) => {
                        const sp = info.species[r[A.species]!]!;
                        return (
                            <li key={r[A.id]}>
                                <button type="button" className="leaderboard__row" onClick={() => onSelect(r[A.id]!)}>
                                    <span className="leaderboard__rank">{i + 1}</span>
                                    <AnimalPortrait carnivore={sp.canHunt} x={r[A.x]!} y={r[A.y]!} />
                                    <span className="leaderboard__who">
                                        <strong>{sp.name}</strong>
                                        <span className="inspector__id">#{r[A.id]}</span>
                                    </span>
                                    <span className="leaderboard__value">{stat.format(r[stat.column]!)}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}
