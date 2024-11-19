import { QueueAPI } from '../types';
/**
 * Get controls and data for the effects queue.
 * @return `{ clear(), flush(), update(), size }`
 */
export declare function useEffectQueue(): QueueAPI;
