import type { EffectsPluginConfig } from '../../types';
import type { ListenerArgs } from '../types';
/**
 * Subscribe to events emitted by the effects state.
 * @param effectType - Name of the effect to listen for. '*' listens to any.
 * @param callback - Function to call when the event is emitted.
 * @param dependencyArray - Array of variables the callback function depends on.
 * @param onEndCallback - Function to call when the effect ends.
 * @param onEndDependencyArray - Array of variables onEndCallback depends on.
 */
export declare function useEffectListener<C extends EffectsPluginConfig, G = any>(...args: ListenerArgs<C['effects'], G>): void;
