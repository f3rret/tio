//"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hookErrorMessage = void 0;
/**
 * Get an error message for when a hook has been used outside a provider.
 * @param hook - The name of the hook that errored.
 * @return - Error message string.
 */
const hookErrorMessage = (hook) => hook +
    ' must be called inside the effects context provider.\n' +
    'Make sure your board component has been correctly wrapped using EffectsBoardWrapper.';
exports.hookErrorMessage = hookErrorMessage;
