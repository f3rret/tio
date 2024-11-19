//"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStore = void 0;
const react_1 = require("react");
/** Hook that returns the current value of a store and keeps it updated. */
function useStore(store) {
    const [state, setState] = (0, react_1.useState)(store.get());
    (0, react_1.useEffect)(() => store.subscribe(setState), [store]);
    return state;
}
exports.useStore = useStore;
