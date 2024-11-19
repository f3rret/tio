//"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useEffectListener = void 0;
const react_1 = require("react");
const contexts_1 = require("../contexts");
const utils_1 = require("./utils");
/**
 * No-op fallback for `useCallback` that is never actually called.
 */
// istanbul ignore next
function noop() { }
/**
 * Subscribe to a Mitt instance with automatic callback memoization & clean-up.
 * @param  emitter - The `EffectsEmitter` instance to subscribe to.
 * @param  effectType - Name of the effect to listen for. '*' listens to any.
 * @param  startHandler - Function to call when the event is emitted.
 * @param  startDeps - Array of variables the handler depends on.
 */
function useEmitterSubscription(emitter, effectType, startHandler, startDeps, endHandler, endDeps = []) {
    endHandler = endHandler || noop;
    /**
     * This is not strictly speaking a safe use of `useCallback.`
     * Code like `useEffectListener('x', flag ? () => {} : () => {}, [])`
     * will be buggy. The initially passed function will never be updated because
     * the functions themselves aren’t included as dependencies (to avoid
     * infinite loops). It seems there is no technically correct way to
     * wrap `useCallback` in a custom hook if the function comes from outside
     * the hook. The only 100% correct solution here would be to require users
     * to pass a stable function they got from `useCallback` themselves,
     * which for now we’ve avoided in order to simplify the API.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const onStartMemo = (0, react_1.useCallback)(startHandler, [...startDeps, effectType]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const onEndMemo = (0, react_1.useCallback)(endHandler, [...endDeps, effectType]);
    (0, react_1.useEffect)(() => {
        let cleanup;
        const onStart = (...args) => {
            if (typeof cleanup === 'function')
                cleanup();
            cleanup = onStartMemo(...args);
        };
        let onEndCleanup;
        const onEnd = (...args) => {
            if (typeof onEndCleanup === 'function')
                onEndCleanup();
            onEndCleanup = onEndMemo(...args);
        };
        const unsubscribe = emitter.on(effectType, onStart, onEnd);
        return () => {
            unsubscribe();
            if (typeof cleanup === 'function')
                cleanup();
            if (typeof onEndCleanup === 'function')
                onEndCleanup();
        };
    }, [effectType, emitter, onStartMemo, onEndMemo]);
}
/**
 * Subscribe to events emitted by the effects state.
 * @param effectType - Name of the effect to listen for. '*' listens to any.
 * @param callback - Function to call when the event is emitted.
 * @param dependencyArray - Array of variables the callback function depends on.
 * @param onEndCallback - Function to call when the effect ends.
 * @param onEndDependencyArray - Array of variables onEndCallback depends on.
 */
function useEffectListener(...args) {
    const emitter = (0, react_1.useContext)(contexts_1.EffectsContext);
    const [effectType, cb, deps, onEndCb, onEndDeps] = args;
    if (!emitter)
        throw new Error((0, utils_1.hookErrorMessage)('useEffectListener'));
    if (!deps)
        throw new TypeError('useEffectListener must receive a dependency list as its third argument.');
    if (onEndCb && !onEndDeps)
        throw new TypeError('useEffectListener must receive a dependency list as its fifth argument when using an onEffectEnd callback.');
    useEmitterSubscription(emitter, effectType, cb, deps, onEndCb, onEndDeps);
}
exports.useEffectListener = useEffectListener;
