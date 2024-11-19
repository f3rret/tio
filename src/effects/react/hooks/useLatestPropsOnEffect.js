//"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useLatestPropsOnEffect = void 0;
const react_1 = require("react");
const useEffectListener_1 = require("./useEffectListener");
const useBoardProps_1 = require("./useBoardProps");
/**
 * Returns the latest board props when one or more effect
 * is triggered. Essentially sugar around `useEffectListener`.
 * @param effectTypes - List of effects to subscribe to.
 * @return The boardgame.io props including G and ctx
 */
function useLatestPropsOnEffect(...effectTypes) {
    const boardProps = (0, useBoardProps_1.useBoardProps)();
    const [props, setProps] = (0, react_1.useState)(boardProps);
    const effects = (0, react_1.useRef)(effectTypes);
    if (effectTypes.length !== effects.current.length ||
        !effects.current.every((v, i) => v === effectTypes[i])) {
        effects.current = effectTypes;
    }
    (0, useEffectListener_1.useEffectListener)('*', (effectName, _payload, boardProps) => {
        if (effects.current.includes(effectName) ||
            effects.current.includes('*')) {
            setProps(boardProps);
        }
    }, [effects]);
    (0, react_1.useEffect)(() => {
        setProps(boardProps);
    }, [boardProps]);
    return props;
}
exports.useLatestPropsOnEffect = useLatestPropsOnEffect;
