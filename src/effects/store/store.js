//"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Store = void 0;
const mitt_1 = __importDefault(require("mitt"));
/** Simple value store with subscribe method to listen for changes. */
class Store {
    constructor(value) {
        this.value = value;
        this.mitt = (0, mitt_1.default)();
    }
    get hasSubscribers() {
        const subscribers = this.mitt.all.get(Store.Event);
        return subscribers !== undefined && subscribers.length > 0;
    }
    /**
     * Subscribe to updates of the store value.
     * @returns An unsubscribe function.
     */
    subscribe(handler) {
        this.mitt.on(Store.Event, handler);
        handler(this.value);
        return () => this.mitt.off(Store.Event, handler);
    }
    /** Update the stored value, notifying all subscribers if it changed. */
    set(value) {
        if (this.value === value)
            return;
        this.value = value;
        this.mitt.emit(Store.Event, value);
    }
    /** Get the currently stored value. */
    get() {
        return this.value;
    }
}
exports.Store = Store;
Store.Event = 'change';
