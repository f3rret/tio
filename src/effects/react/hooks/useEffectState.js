//"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useEffectState = void 0;
const react_1 = require("react");
const useEffectListener_1 = require("./useEffectListener");
/**
 * Subscribe to the latest value of a particular effect.
 * This hook is sugar around `useEffectListener` and `useState`.
 * @param effectType - Name of the effect to subscribe to.
 * @param initialState - Value to use for state before effect first fires.
 * @return - Tuple of `[effectState: any, isActive: boolean]`.
 * `effectState` will be `undefined` on initial render if `initialState` is not set.
 * `isActive` is true for the length of the effect’s duration.
 */
function useEffectState(effectType, initialState, _config) {
    const [state, setState] = (0, react_1.useState)(initialState);
    const [isActive, setIsActive] = (0, react_1.useState)(false);
    (0, useEffectListener_1.useEffectListener)(effectType, (payload) => {
        setState(payload);
        setIsActive(true);
    }, [], () => setIsActive(false), []);
    return [state, isActive];
}
exports.useEffectState = useEffectState;
