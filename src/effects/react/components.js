//"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EffectsBoardWrapper = void 0;
const react_1 = __importStar(require("react"));
const contexts_1 = require("./contexts");
const emitter_1 = require("../emitter/emitter");
const useStore_1 = require("./hooks/useStore");
/**
 * Returns a component that will render your board wrapped in
 * an effect emitting context provider.
 * @param board - The board component to wrap.
 * @param opts  - Optional object to configure options for effect emitter.
 *
 * @example
 * import { EffectsBoardWrapper } from 'bgio-effects'
 * import MyBoard from './board.js'
 * const BoardWithEffects = EffectsBoardWrapper(MyBoard)
 */
function EffectsBoardWrapper(Board, opts) {
    return function BoardWithEffectsProvider(boardProps) {
        return EffectsProvider({ boardProps, Board, opts });
    };
}
exports.EffectsBoardWrapper = EffectsBoardWrapper;
/**
 * Context provider that watches boardgame.io state and emits effect events.
 */
function EffectsProvider({ Board, boardProps, opts, }) {
    const [emitter] = (0, react_1.useState)(() => {
        const emitter = (0, emitter_1.InternalEffectsEmitter)(opts);
        emitter.onUpdate(boardProps);
        return emitter;
    });
    // When props change, let the emitter handle the update.
    (0, react_1.useEffect)(() => emitter.onUpdate(boardProps), [boardProps, emitter]);
    /** Public API for manipulating the EffectsEmitter queue. */
    const queueAPI = {
        /**
         * Callback that clears the effect queue, cancelling future effects and
         * immediately calling any outstanding onEnd callbacks.
         */
        clear: (0, react_1.useCallback)(() => emitter.clear(), [emitter]),
        /**
         * Callback that immediately emits all remaining effects and clears the queue.
         * When flushing, onEnd callbacks are run immediately.
         */
        flush: (0, react_1.useCallback)(() => emitter.flush(), [emitter]),
        /**
         * Callback that immediately updates the props to the latest props received.
         */
        update: (0, react_1.useCallback)(() => {
            emitter.state.set(boardProps);
        }, [emitter.state, boardProps]),
        /**
         * The number of effects currently in the queue.
         */
        size: (0, useStore_1.useStore)(emitter.size),
    };
    // Subscribe to the emitter's state and use it as the source of the board’s props.
    const bgioProps = (0, useStore_1.useStore)(emitter.state);
    const props = (opts === null || opts === void 0 ? void 0 : opts.updateStateAfterEffects) ? bgioProps : boardProps;
    return (react_1.default.createElement(contexts_1.EffectsContext.Provider, { value: emitter },
        react_1.default.createElement(contexts_1.EffectsQueueContext.Provider, { value: queueAPI },
            react_1.default.createElement(contexts_1.EffectsPropsContext.Provider, { value: props },
                react_1.default.createElement(Board, Object.assign({}, props))))));
}
