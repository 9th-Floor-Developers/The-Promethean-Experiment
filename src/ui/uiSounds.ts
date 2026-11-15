import buttonClickUrl from '../../assets/button-click.mp3';
import dropdownClickUrl from '../../assets/dropdown-click.mp3';


/** The interface sounds, by what triggers them. */
type UiSound = 'button' | 'dropdown';

const SOUND_URLS: Record<UiSound, string> = { button: buttonClickUrl, dropdown: dropdownClickUrl };

/** Whether the sounds play at all; follows the "Sound effects" display setting. */
let enabled = true;
/** Loudness of the sounds, 0..1; follows the "Volume" display setting. */
let volume = 0.6;
let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
const buffers: Partial<Record<UiSound, AudioBuffer>> = {};

/**
 * Plays one interface sound. Uses Web Audio so rapid clicks overlap instead of cutting each other off. The audio context
 * is created by the first click (browsers only allow sound after a user gesture), and the clips are decoded then too;
 * a sound whose clip is not decoded yet is skipped rather than played late.
 */
function play(sound: UiSound): void {
    if (!enabled) return;
    if (!ctx) {
        ctx = new AudioContext();
        gain = ctx.createGain();
        gain.gain.value = volume;
        gain.connect(ctx.destination);
        for (const key of Object.keys(SOUND_URLS) as UiSound[]) {
            fetch(SOUND_URLS[key])
                .then((r) => r.arrayBuffer())
                .then((data) => ctx!.decodeAudioData(data))
                .then((buffer) => {
                    buffers[key] = buffer;
                    if (key === sound) start(buffer); // the very first click still gets its sound
                })
                .catch((e) => console.warn(`UI sound "${key}" failed to load`, e));
        }
        return;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    const buffer = buffers[sound];
    if (buffer) start(buffer);
}

/** Starts [buffer] playing once through the shared volume node. */
function start(buffer: AudioBuffer): void {
    const source = ctx!.createBufferSource();
    source.buffer = buffer;
    source.connect(gain!);
    source.start();
}

/** Turns the interface sounds on or off (Settings -> Display -> Sound effects). */
export function setUiSoundsEnabled(on: boolean): void {
    enabled = on;
}

/** Sets the loudness of the interface sounds, 0 (silent) to 1 (full) (Settings -> Display -> Volume). */
export function setUiSoundsVolume(level: number): void {
    volume = Math.min(1, Math.max(0, level));
    if (gain) gain.gain.value = volume;
}

/**
 * Hooks the interface sounds (assets/*.mp3) onto the whole page: every enabled `<button>` clicks, and every `<select>`
 * clicks when a new option is chosen. Listening on the document means new buttons and dropdowns need no wiring.
 * Call once at startup.
 */
export function installUiSounds(): void {
    document.addEventListener('click', (e) => {
        const button = (e.target as Element | null)?.closest?.('button');
        if (button && !button.disabled) play('button');
    }, true);
    document.addEventListener('change', (e) => {
        if (e.target instanceof HTMLSelectElement) play('dropdown');
    }, true);
}
