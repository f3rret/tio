import type { Store } from '../../store';
/** Hook that returns the current value of a store and keeps it updated. */
export declare function useStore<Value>(store: Store<Value>): Readonly<Value>;
