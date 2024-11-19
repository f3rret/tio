//"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useBoardProps = void 0;
const react_1 = require("react");
const contexts_1 = require("../contexts");
const utils_1 = require("./utils");
/**
 * Get current board props as maintained by the effects plugin
 * @return - The boardgame.io props including G and ctx
 */
function useBoardProps() {
    const ctx = (0, react_1.useContext)(contexts_1.EffectsPropsContext);
    if (!ctx)
        throw new Error((0, utils_1.hookErrorMessage)('useBoardProps'));
    return ctx;
}
exports.useBoardProps = useBoardProps;
