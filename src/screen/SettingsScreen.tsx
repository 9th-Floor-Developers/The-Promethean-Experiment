import { useEffect, useRef, useState } from 'react';
import {
    CATEGORIES, EXTRA_TRAITS, MAP_SIZE, MAX_COUNT, RESOURCE, MAX_SPECIES, MIN_COUNT, STATS, carnivoreTemplate, herbivoreTemplate,
    newSpeciesName, type SimSettings, type SpeciesSettings, type StatKey,
} from '../settings/speciesSettings';
import { activePreset, builtInSettings, createPreset, duplicatePreset, type PresetStore } from '../settings/presets';

interface Props {
    store: PresetStore;
    onChange: (next: PresetStore) => void;
    onDone: () => void;
}

/** The resource sliders on the World tab. 100% is the normal amount. */
const RESOURCES = [
    { key: 'water', label: 'Water', help: 'How many ponds are scattered inland. The coast always has water.' },
    { key: 'trees', label: 'Trees', help: 'How many trees grow, especially in forests. Plant eaters feed on them.' },
    { key: 'grass', label: 'Grass', help: 'How much grass grows, mostly on plains. Plant eaters feed on it.' },
] as const;

/** Formats a stat for display next to its slider. */
function formatStat(v: number, step: number): string {
    return step >= 1 ? String(v) : v.toFixed(step < 0.01 ? 3 : 2);
}

/**
 * Settings screen: choose which species run in the simulation, how many of each, and their stats and traits.
 * Every control has a plain-language label and help text. Changes apply the next time the simulation starts;
 * Done (or Escape) returns to the main menu.
 */
export function SettingsScreen({ store, onChange: onStoreChange, onDone }: Props) {
    const preset = activePreset(store);
    const settings = preset.settings;
    /** Edits the active preset's settings. */
    const onChange = (next: SimSettings) =>
        onStoreChange({ ...store, presets: store.presets.map((p) => (p.id === preset.id ? { ...p, settings: next } : p)) });
    const select = (id: string) => onStoreChange({ ...store, activeId: id });
    const rename = (name: string) => onStoreChange({ ...store, presets: store.presets.map((p) => (p.id === preset.id ? { ...p, name } : p)) });
    const addPreset = (p: ReturnType<typeof createPreset>) => onStoreChange({ presets: [...store.presets, p], activeId: p.id });
    const remove = () => {
        if (store.presets.length < 2 || !window.confirm(`Delete the preset "${preset.name}"? This cannot be undone.`)) return;
        const presets = store.presets.filter((p) => p.id !== preset.id);
        onStoreChange({ presets, activeId: presets[0]!.id });
    };

    const doneRef = useRef<HTMLButtonElement>(null);
    const [tab, setTab] = useState<'species' | 'world'>('species');

    useEffect(() => {
        doneRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !(e.target instanceof HTMLSelectElement)) onDone();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onDone]);

    const update = (uid: number, patch: (s: SpeciesSettings) => SpeciesSettings) =>
        onChange({ ...settings, species: settings.species.map((s) => (s.uid === uid ? patch(s) : s)) });
    const add = (make: () => SpeciesSettings) => {
        const s = make();
        onChange({ ...settings, species: [...settings.species, { ...s, name: newSpeciesName(settings.species) }] });
    };
    const canAdd = settings.species.length < MAX_SPECIES;

    return (
        <section className="settings" aria-labelledby="settings-heading">
            <header className="settings__top">
                <div>
                    <h1 id="settings-heading" className="settings__heading">Settings</h1>
                    <p className="settings__intro">Design the animals that will live on the island. Changes are saved automatically and used the next time you press Start Simulation.</p>
                </div>
                <div className="settings__actions">
                    <button ref={doneRef} type="button" className="btn btn--primary" onClick={onDone}>Done</button>
                </div>
            </header>

            <section className="presets" aria-label="Presets">
                <label className="field">
                    <span className="field__label">Preset (the one that runs)</span>
                    <select className="input" value={preset.id} onChange={(e) => select(e.target.value)}>
                        {store.presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </label>
                <label className="field field--grow">
                    <span className="field__label">Preset name</span>
                    <input className="input" value={preset.name} maxLength={40} onChange={(e) => rename(e.target.value)}
                        onBlur={(e) => { if (!e.target.value.trim()) rename('Preset'); }} />
                </label>
                <div className="presets__buttons">
                    <button type="button" className="btn" onClick={() => addPreset(createPreset())}>New</button>
                    <button type="button" className="btn" onClick={() => addPreset(duplicatePreset(preset))}>Duplicate</button>
                    {preset.builtIn && <button type="button" className="btn" title="Put this preset back to how it came"
                        onClick={() => onChange(builtInSettings(preset.builtIn!))}>Reset to original</button>}
                    <button type="button" className="btn" disabled={store.presets.length < 2} onClick={remove}>Delete</button>
                </div>
            </section>

            <div className="tabs" role="tablist" aria-label="Settings sections">
                <button type="button" role="tab" id="tab-species" aria-selected={tab === 'species'} aria-controls="panel-species"
                    className={`tab${tab === 'species' ? ' tab--on' : ''}`} onClick={() => setTab('species')}>Species</button>
                <button type="button" role="tab" id="tab-world" aria-selected={tab === 'world'} aria-controls="panel-world"
                    className={`tab${tab === 'world' ? ' tab--on' : ''}`} onClick={() => setTab('world')}>World</button>
            </div>

            {tab === 'world' && (
                <article className="species-card" role="tabpanel" id="panel-world" aria-labelledby="tab-world">
                    <h2 className="species-card__title">The island</h2>
                    <div className="stat">
                        <label htmlFor="map-size" className="stat__label">Map size <strong>{settings.mapSize} × {settings.mapSize} tiles</strong></label>
                        <input id="map-size" className="slider" type="range" min={MAP_SIZE.min} max={MAP_SIZE.max} step={MAP_SIZE.step} value={settings.mapSize}
                            onChange={(e) => onChange({ ...settings, mapSize: Number(e.target.value) })} />
                        <div className="stat__ends"><span>Small island</span><span>Huge island</span></div>
                        <p className="stat__help">How big the world is. The island is regenerated when you press Done. Bigger maps give animals more room but may run slower.</p>
                    </div>
                    <h2 className="species-card__title">Food and water</h2>
                    <div className="stats">
                        {RESOURCES.map((r) => (
                            <div key={r.key} className="stat">
                                <label htmlFor={`res-${r.key}`} className="stat__label">{r.label} <strong>{Math.round(settings[r.key] * 100)}%</strong></label>
                                <input id={`res-${r.key}`} className="slider" type="range" min={RESOURCE.min} max={RESOURCE.max} step={RESOURCE.step} value={settings[r.key]}
                                    onChange={(e) => onChange({ ...settings, [r.key]: Number(e.target.value) })} />
                                <div className="stat__ends"><span>Scarce</span><span>Plentiful</span></div>
                                <p className="stat__help">{r.help}</p>
                            </div>
                        ))}
                    </div>
                </article>
            )}

            {tab === 'species' && <div className="settings__list" role="tabpanel" id="panel-species" aria-labelledby="tab-species">
                {settings.species.map((sp, index) => (
                    <SpeciesCard key={sp.uid} sp={sp} index={index} canRemove={settings.species.length > 1}
                        onPatch={(p) => update(sp.uid, p)}
                        onRemove={() => onChange({ ...settings, species: settings.species.filter((s) => s.uid !== sp.uid) })} />
                ))}
            </div>}

            {tab === 'species' && <div className="settings__add">
                <button type="button" className="btn" disabled={!canAdd} onClick={() => add(herbivoreTemplate)}>+ Add a plant eater</button>
                <button type="button" className="btn" disabled={!canAdd} onClick={() => add(carnivoreTemplate)}>+ Add a meat eater</button>
                {!canAdd && <span className="settings__hint">You can have up to {MAX_SPECIES} species.</span>}
            </div>}
            {tab === 'species' && <p className="settings__hint">
                Diet, daily schedule and self-healing change how animals behave right now; the other traits are recorded for future updates.
            </p>}
        </section>
    );
}

interface CardProps {
    sp: SpeciesSettings;
    index: number;
    canRemove: boolean;
    onPatch: (patch: (s: SpeciesSettings) => SpeciesSettings) => void;
    onRemove: () => void;
}

/** One species: name, starting population, stat sliders, trait dropdowns and optional-trait toggles. */
function SpeciesCard({ sp, index, canRemove, onPatch, onRemove }: CardProps) {
    const id = `sp${sp.uid}`;
    const setTrait = (categoryKey: string, traitId: string) => {
        const category = CATEGORIES.find((c) => c.key === categoryKey)!;
        const ids = new Set(category.options.map((o) => o.id));
        onPatch((s) => ({ ...s, traits: [...s.traits.filter((t) => !ids.has(t)), traitId] }));
    };
    const toggleExtra = (traitId: string) =>
        onPatch((s) => ({ ...s, traits: s.traits.includes(traitId) ? s.traits.filter((t) => t !== traitId) : [...s.traits, traitId] }));

    return (
        <article className="species-card" aria-label={sp.name}>
            <header className="species-card__head">
                <span className="species-card__badge">{index + 1}</span>
                <label className="field field--grow">
                    <span className="field__label">Species name</span>
                    <input className="input" value={sp.name} maxLength={24} onChange={(e) => onPatch((s) => ({ ...s, name: e.target.value }))} />
                </label>
                <label className="field">
                    <span className="field__label">Starting animals</span>
                    <input className="input input--num" type="number" min={MIN_COUNT} max={MAX_COUNT} value={sp.count}
                        onChange={(e) => onPatch((s) => ({ ...s, count: Math.max(MIN_COUNT, Math.min(MAX_COUNT, Number(e.target.value) || MIN_COUNT)) }))} />
                </label>
                {canRemove && <button type="button" className="btn species-card__remove" onClick={onRemove} aria-label={`Remove ${sp.name}`}>Remove</button>}
            </header>

            <h2 className="species-card__title">Body and abilities</h2>
            <div className="stats">
                {STATS.map((d) => (
                    <div key={d.key} className="stat">
                        <label htmlFor={`${id}-${d.key}`} className="stat__label">
                            {d.label} <strong>{formatStat(sp.stats[d.key], d.step)}{d.unit}</strong>
                        </label>
                        <input id={`${id}-${d.key}`} className="slider" type="range" min={d.min} max={d.max} step={d.step} value={sp.stats[d.key]}
                            onChange={(e) => onPatch((s) => ({ ...s, stats: { ...s.stats, [d.key as StatKey]: Number(e.target.value) } }))} />
                        <div className="stat__ends"><span>{d.low}</span><span>{d.high}</span></div>
                        <p className="stat__help">{d.help}</p>
                    </div>
                ))}
            </div>

            <h2 className="species-card__title">Traits</h2>
            <div className="traits">
                {CATEGORIES.map((c) => {
                    const current = c.options.find((o) => sp.traits.includes(o.id));
                    return (
                        <div key={c.key} className="trait">
                            <label htmlFor={`${id}-${c.key}`} className="trait__label">{c.label}</label>
                            <select id={`${id}-${c.key}`} className="input" value={current?.id ?? ''} onChange={(e) => setTrait(c.key, e.target.value)}>
                                {!current && <option value="" disabled>Choose…</option>}
                                {c.options.map((o) => <option key={o.id} value={o.id} disabled={o.unavailable}>{o.label}{o.unavailable ? ' (coming soon)' : ''}</option>)}
                            </select>
                            <p className="stat__help">{current?.help ?? c.question}</p>
                        </div>
                    );
                })}
            </div>

            <h2 className="species-card__title">Extra abilities <span className="settings__hint">(optional)</span></h2>
            <div className="chips">
                {EXTRA_TRAITS.map((t) => (
                    <button key={t.id} type="button" className={`chip${sp.traits.includes(t.id) ? ' chip--on' : ''}`} aria-pressed={sp.traits.includes(t.id)}
                        title={t.help} onClick={() => toggleExtra(t.id)}>
                        {t.label}
                    </button>
                ))}
            </div>
        </article>
    );
}
