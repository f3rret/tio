//"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EffectsPlugin = void 0;
const timeline_1 = require("./timeline");
const alphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
/** Simple 8-character UUID generator based on nanoid/non-secure. */
const uuid = () => {
    let id = '';
    let i = 8;
    while (i--)
        id += alphabet[(Math.random() * 64) | 0];
    return id;
};
/**
 * Generate the data POJO to persist from a Timeline instance.
 * @return - Object with a unique `id`, `duration` in seconds & `queue` array.
 */
const getData = (timeline) => {
    //console.log('getData', JSON.stringify(timeline))
    return {
    id: uuid(),
    duration: timeline.duration(),
    queue: timeline.getQueue(),
}};
/**
 * Create a boardgame.io plugin that will provide an “effects” API.
 * @param config - Configuration object
 * @return - boardgame.io plugin object
 */
const EffectsPlugin = (config) => {
    const plugin = {
        name: 'effects',
        setup: () => getData(new timeline_1.Timeline()),
        api: () => {
            const api = { timeline: new timeline_1.Timeline() };
            for (const type in config.effects) {
                if (type === 'timeline') {
                    throw new RangeError('Cannot create effect type “timeline”. Name is reserved.');
                }
                const { create, duration: defaultDuration } = config.effects[type];
                api[type] = (...args) => {
                    const effect = create ? { type, payload: create(args[0]) } : { type };
                    const [position, duration = defaultDuration] = create
                        ? args.slice(1)
                        : args;
                
                    api.timeline.add(effect, position, duration);
                };
            }
            return api;
        },
        flush: ({ api }) => {
            //return getData(new timeline_1.Timeline())
            return getData(api.timeline)
        },
    };
    return plugin;
};
exports.EffectsPlugin = EffectsPlugin;
