//"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComputedStore = void 0;
const store_1 = require("./store");
/** Store whose value is derived from that of another `Store` */
class ComputedStore extends store_1.Store {
    constructor(store, selector) {
        // Initialise stored value using current parent store value.
        super(selector(store.get()));
        this.store = store;
        this.selector = selector;
    }
    /** Initiate subscription to parent store if necessary. */
    start() {
        if (this.unsubscribe)
            return;
        this.unsubscribe = this.store.subscribe((value) => {
            this.set(this.selector(value));
        });
    }
    /** Unsubscribe from parent store if no-one is subscribed to computed state. */
    stop() {
        if (!this.unsubscribe || this.hasSubscribers)
            return;
        this.unsubscribe();
        delete this.unsubscribe;
    }
    /**
     * Subscribe to updates of the stored value.
     * @returns An unsubscribe function.
     */
    subscribe(handler) {
        this.start();
        const unsubscribe = super.subscribe(handler);
        return () => {
            unsubscribe();
            this.stop();
        };
    }
    /** Get the currently stored value. */
    get() {
        // Compute the current value on demand. This could be inefficient if the
        // selector were expensive, but that’s not the case for our usage.
        return this.selector(this.store.get());
    }
}
exports.ComputedStore = ComputedStore;
