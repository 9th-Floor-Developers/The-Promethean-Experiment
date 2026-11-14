/**
 * Marks the main viewport region. Holds no canvas of its own: the single persistent WorldScene canvas
 * is positioned over this cell (see .scene-canvas--viewport), so there is one renderer and one render loop.
 * Pointer events pass through here to the canvas for the later interaction work.
 */
export function SimulationViewport() {
    return <div className="sim__viewport" aria-hidden="true" />;
}
