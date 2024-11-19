import type { Plugin } from 'boardgame.io';
import type { API, Data, EffectsPluginConfig } from './types';
/**
 * More precise type for the plugin object, based on the boardgame.io plugin type.
 */
declare type EffectsPluginInterface<C extends EffectsPluginConfig> = Required<Pick<Plugin<API<C['effects']>, Data>, 'name' | 'setup' | 'api' | 'flush'>>;
/**
 * Create a boardgame.io plugin that will provide an “effects” API.
 * @param config - Configuration object
 * @return - boardgame.io plugin object
 */
export declare const EffectsPlugin: <C extends EffectsPluginConfig>(config: C) => Required<Pick<Plugin<API<C["effects"]>, Data, any>, "name" | "setup" | "api" | "flush">>;
export {};
