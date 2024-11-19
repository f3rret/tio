import type { Handler } from 'mitt';
import { Store } from './store';
/** Store whose value is derived from that of another `Store` */
export declare class ComputedStore<ComputedValue, Value> extends Store<ComputedValue> {
    private readonly store;
    private readonly selector;
    private unsubscribe?;
    constructor(store: Store<Value>, selector: (value: Readonly<Value>) => ComputedValue);
    /** Initiate subscription to parent store if necessary. */
    private start;
    /** Unsubscribe from parent store if no-one is subscribed to computed state. */
    private stop;
    /**
     * Subscribe to updates of the stored value.
     * @returns An unsubscribe function.
     */
    subscribe(handler: Handler<Readonly<ComputedValue>>): () => void;
    /** Get the currently stored value. */
    get(): Readonly<ComputedValue>;
}
/** Value store. `subscribe` for updates, or `get` the current value. */
export declare type ReadonlyStore<Value> = Omit<Store<Value>, 'set'>;
