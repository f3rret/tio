/**
 * Manage starting and stopping a `requestAnimationFrame` loop.
 *
 * Will fallback to running a `setTimeout` once per second if the
 * `requestAnimationFrame` callback isn’t executed in time (for example when
 * the browser tab is in the background).
 */
export declare class RafRunner {
    private readonly callback;
    private running;
    private raf?;
    private timeout?;
    constructor(callback: () => void);
    private requestFrame;
    private cancelFrames;
    start(): void;
    stop(): void;
}
