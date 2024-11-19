import type { Client } from 'boardgame.io/client';
import type { ClientState } from 'boardgame.io/dist/types/src/client/client';
import { Store, ComputedStore, ReadonlyStore } from '../store';
import type { Queue } from '../types';
interface EffectsEmitterOptions {
    speed?: number;
    updateStateAfterEffects?: boolean;
}
declare type PublicHandler<S extends ClientState> = (effectPayload: any, state: S) => void;
declare type PublicWildcardHandler<S extends ClientState> = (effectType: string, effectPayload: any, state: S) => void;
export interface EffectsEmitter<S extends ClientState> {
    /**
     * Register listeners for a specific effect type (or the wildcard effect `'*'`).
     * @returns An unsubscribe function.
     */
    on(effect: '*', callback?: PublicWildcardHandler<S>, onEndCallback?: PublicWildcardHandler<S>): () => void;
    on(effect: Exclude<string, '*'>, callback?: PublicHandler<S>, onEndCallback?: PublicHandler<any>): () => void;
    clear(): void;
    flush(): void;
    size: ReadonlyStore<number>;
    state: ReadonlyStore<S | null>;
}
declare class EffectsEmitterImpl<S extends ClientState> implements EffectsEmitter<S> {
    private readonly speed;
    private readonly updateStateAfterEffects;
    private readonly emitter;
    private readonly endEmitter;
    private readonly raf;
    private readonly queue;
    private activeQueue;
    private latestState;
    private startT;
    private duration;
    /**
     * Store for the current boardgame.io client state.
     */
    readonly state: Store<S | null>;
    constructor(speed?: number, updateStateAfterEffects?: boolean);
    on(effect: '*', callback?: PublicWildcardHandler<S>, onEndCallback?: PublicWildcardHandler<S>): () => void;
    on(effect: Exclude<string, '*'>, callback?: PublicHandler<S>, onEndCallback?: PublicHandler<S>): () => void;
    private off;
    /**
     * Callback that clears the effect queue, cancelling future effects and
     * immediately calling any outstanding onEnd callbacks.
     */
    clear(): void;
    /**
     * Callback that immediately emits all remaining effects and clears the queue.
     * When flushing, onEnd callbacks are run immediately.
     */
    flush(): void;
    /** Get the number of effects currently queued to be emitted. */
    size: ComputedStore<number, Queue>;
    /**
     * Update the queue state when a new state update is received from boardgame.io.
     */
    onUpdate(state: null | S): void;
    /**
     * requestAnimationFrame loop which dispatches effects and updates the queue
     * every tick while active.
     */
    private onRaf;
    /**
     * Emit an effect from the provided emitter, bundling payload and boardProps
     * into the effect object.
     */
    private emit;
    /**
     * Dispatch all effects in the provided queue via the provided emitter.
     * @param emitter - Mitt instance.
     * @param effects - Effects queue to process.
     */
    private emitAllEffects;
}
export declare function InternalEffectsEmitter<S extends ClientState>({ speed, updateStateAfterEffects, }?: EffectsEmitterOptions): EffectsEmitterImpl<S>;
export declare function EffectsEmitter(client: {
    subscribe: ReturnType<typeof Client>['subscribe'];
}, opts?: EffectsEmitterOptions): EffectsEmitter<ClientState>;
export {};
