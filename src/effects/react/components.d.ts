import React from 'react';
import type { BoardProps } from 'boardgame.io/react';
/**
 * Configuration options that can be passed to EffectsBoardWrapper.
 */
interface EffectsOpts {
    speed?: number;
    updateStateAfterEffects?: boolean;
}
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
export declare function EffectsBoardWrapper<G = any, P extends BoardProps<G> = BoardProps<G>>(Board: React.ComponentType<P>, opts?: EffectsOpts): React.ComponentType<P>;
export {};
