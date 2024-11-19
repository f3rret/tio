import type { Queue, Effect, TimingParams } from './types';
/**
 * Timeline that allows adding data and returning an ordered queue of
 * data by timestamp.
 */
export declare class Timeline {
    private _last;
    private _keyframes: Map;
    private _duration;
    constructor();
    /**
     * True when the timeline has no entries.
     */
    isEmpty(): boolean;
    /**
     * The total duration of the current timeline.
     */
    duration(): number;
    /**
     * Get a sorted array of keyframe keys.
     */
    private keys;
    /**
     * Shift keyframes along the timeline.
     * @param amount Amount of time to shift keyframes by.
     * @param start  Start shifting keyframes after this time.
     */
    private shift;
    /**
     * Add data to the timeline.
     * @param effect     Effect data to add to the timeline.
     * @param position Position of the effect on the timeline.
     *                 - Number places the effect at an absolute time in seconds, e.g. 3
     *                 - '<': relative to start of last effect in timeline, e.g. '<-1', '<+0.5'
     *                 - '>': relative to end of timeline, e.g. '>+2', '>-0.2'
     *                 - '^': insert at absolute time & shift following events, e.g. '^2->0.5'
     * @param duration Duration of the effect when played back.
     */
    add(effect: Effect, position?: TimingParams[0], duration?: TimingParams[1]): void;
    /**
     * Get a simple representation of the current queue.
     * @return Sorted array of effects.
     *         Each effect has a property `t` specifying its time on the timeline.
     */
    getQueue(): Queue;
    /**
     * Clear the timeline, removing all effects.
     */
    clear(): void;
}
