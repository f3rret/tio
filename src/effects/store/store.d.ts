import { Handler } from 'mitt';
/** Simple value store with subscribe method to listen for changes. */
export declare class Store<Value> {
    private value;
    private static readonly Event;
    private readonly mitt;
    constructor(value: Value);
    protected get hasSubscribers(): boolean;
    /**
     * Subscribe to updates of the store value.
     * @returns An unsubscribe function.
     */
    subscribe(handler: Handler<Readonly<Value>>): () => void;
    /** Update the stored value, notifying all subscribers if it changed. */
    set(value: Value): void;
    /** Get the currently stored value. */
    get(): Readonly<Value>;
}
