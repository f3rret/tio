//"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useEffectQueue = void 0;
const react_1 = require("react");
const contexts_1 = require("../contexts");
const utils_1 = require("./utils");
/**
 * Get controls and data for the effects queue.
 * @return `{ clear(), flush(), update(), size }`
 */
function useEffectQueue() {
    const ctx = (0, react_1.useContext)(contexts_1.EffectsQueueContext);
    if (!ctx)
        throw new Error((0, utils_1.hookErrorMessage)('useEffectQueue'));
    return ctx;
}
exports.useEffectQueue = useEffectQueue;
