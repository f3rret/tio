//"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EffectsEmitter = exports.InternalEffectsEmitter = void 0;
const mitt_1 = __importDefault(require("mitt"));
const store_1 = require("../store");
const raf_runner_1 = require("./raf-runner");
class EffectsEmitterImpl {
    constructor(speed = 1, updateStateAfterEffects = false) {
        this.speed = speed;
        this.updateStateAfterEffects = updateStateAfterEffects;
        this.emitter = (0, mitt_1.default)();
        this.endEmitter = (0, mitt_1.default)();
        this.raf = new raf_runner_1.RafRunner(() => this.onRaf());
        this.queue = new store_1.Store([]);
        this.activeQueue = [];
        this.latestState = null;
        this.startT = 0;
        this.duration = 0;
        /**
         * Store for the current boardgame.io client state.
         */
        this.state = new store_1.Store(null);
        /** Get the number of effects currently queued to be emitted. */
        this.size = new store_1.ComputedStore(this.queue, (queue) => queue.length);
    }
    on(effect, callback, onEndCallback) {
        let startCb;
        if (callback) {
            startCb =
                effect === '*'
                    ? (type, { payload, boardProps }) => callback(type, payload, boardProps)
                    : ({ payload, boardProps }) => callback(payload, boardProps);
            this.emitter.on(effect, startCb);
        }
        let endCb;
        if (onEndCallback) {
            endCb =
                effect === '*'
                    ? (type, { payload, boardProps }) => onEndCallback(type, payload, boardProps)
                    : ({ payload, boardProps }) => onEndCallback(payload, boardProps);
            this.endEmitter.on(effect, endCb);
        }
        return () => this.off(effect, startCb, endCb);
    }
    off(effect, callback, onEndCallback) {
        this.emitter.off(effect, callback);
        this.endEmitter.off(effect, onEndCallback);
    }
    /**
     * Callback that clears the effect queue, cancelling future effects and
     * immediately calling any outstanding onEnd callbacks.
     */
    clear() {
        this.raf.stop();
        this.emitAllEffects(this.endEmitter, this.activeQueue);
        this.queue.set([]);
        this.activeQueue = [];
        this.state.set(this.latestState);
    }
    /**
     * Callback that immediately emits all remaining effects and clears the queue.
     * When flushing, onEnd callbacks are run immediately.
     */
    flush() {
        const queue = this.queue.get();
        this.emitAllEffects(this.emitter, queue);
        this.activeQueue = [...this.activeQueue, ...queue];
        this.clear();
    }
    /**
     * Update the queue state when a new state update is received from boardgame.io.
     */
    onUpdate(state) {
        this.flush();
        const prevState = this.latestState;
        this.latestState = state;
        if (!state ||
            !state.plugins.effects ||
            !prevState ||
            !prevState.plugins.effects ||
            state.plugins.effects.data.id === prevState.plugins.effects.data.id) {
            this.state.set(state);
            return;
        }
        this.queue.set(state.plugins.effects.data.queue);
        this.activeQueue = [];
        this.startT = performance.now();
        this.duration = state.plugins.effects.data.duration;
        this.raf.start();
    }
    /**
     * requestAnimationFrame loop which dispatches effects and updates the queue
     * every tick while active.
     */
    onRaf() {
        const elapsedT = ((performance.now() - this.startT) / 1000) * this.speed;
        const newActiveQueue = [];
        // Loop through the queue of active effects.
        let ended = false;
        for (const effect of this.activeQueue) {
            if (effect.endT > elapsedT) {
                newActiveQueue.push(effect);
                continue;
            }
            this.emit(this.endEmitter, effect);
            ended = true;
        }
        // Loop through the effects queue, emitting any effects whose time has come.
        const queue = this.queue.get();
        let i = 0;
        for (i = 0; i < queue.length; i++) {
            const effect = queue[i];
            if (effect.t > elapsedT)
                break;
            this.emit(this.emitter, effect);
            newActiveQueue.push(effect);
        }
        // Also update the global boardgame.io props once their time is reached.
        const bgioStateT = this.updateStateAfterEffects ? this.duration : 0;
        if (elapsedT >= bgioStateT && this.state.get() !== this.latestState)
            this.state.set(this.latestState);
        if (elapsedT > this.duration)
            this.raf.stop();
        // Update the queue to only contain effects still in the future.
        if (i > 0)
            this.queue.set(queue.slice(i));
        if (i > 0 || ended)
            this.activeQueue = newActiveQueue;
    }
    /**
     * Emit an effect from the provided emitter, bundling payload and boardProps
     * into the effect object.
     */
    emit(emitter, { type, payload }) {
        const effect = {
            payload,
            boardProps: this.latestState,
        };
        emitter.emit(type, effect);
    }
    /**
     * Dispatch all effects in the provided queue via the provided emitter.
     * @param emitter - Mitt instance.
     * @param effects - Effects queue to process.
     */
    emitAllEffects(emitter, effects) {
        for (const effect of effects) {
            this.emit(emitter, effect);
        }
    }
}
function InternalEffectsEmitter({ speed, updateStateAfterEffects, } = {}) {
    return new EffectsEmitterImpl(speed, updateStateAfterEffects);
}
exports.InternalEffectsEmitter = InternalEffectsEmitter;
function EffectsEmitter(client, opts) {
    const emitter = InternalEffectsEmitter(opts);
    client.subscribe(emitter.onUpdate.bind(emitter));
    return emitter;
}
exports.EffectsEmitter = EffectsEmitter;
