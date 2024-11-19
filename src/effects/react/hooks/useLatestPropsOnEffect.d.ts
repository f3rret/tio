import type { BoardProps } from 'boardgame.io/react';
import type { BuiltinEffect, EffectsPluginConfig } from '../../types';
declare type EffectType<C extends EffectsPluginConfig> = BuiltinEffect | '*' | keyof C['effects'];
/**
 * Returns the latest board props when one or more effect
 * is triggered. Essentially sugar around `useEffectListener`.
 * @param effectTypes - List of effects to subscribe to.
 * @return The boardgame.io props including G and ctx
 */
export declare function useLatestPropsOnEffect<G = any, C extends EffectsPluginConfig = EffectsPluginConfig>(...effectTypes: EffectType<C>[]): BoardProps<G>;
export {};
