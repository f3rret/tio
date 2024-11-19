//"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RafRunner = void 0;
/**
 * Manage starting and stopping a `requestAnimationFrame` loop.
 *
 * Will fallback to running a `setTimeout` once per second if the
 * `requestAnimationFrame` callback isn’t executed in time (for example when
 * the browser tab is in the background).
 */
class RafRunner {
    constructor(callback) {
        this.callback = callback;
        this.running = false;
    }
    requestFrame(onFrame) {
        this.raf = requestAnimationFrame(onFrame);
        this.timeout = setTimeout(onFrame, 1000);
    }
    cancelFrames() {
        if (this.raf)
            cancelAnimationFrame(this.raf);
        if (this.timeout)
            clearTimeout(this.timeout);
    }
    start() {
        if (this.running)
            return;
        const onFrame = () => {
            if (!this.running)
                return;
            this.cancelFrames();
            this.callback();
            this.requestFrame(onFrame);
        };
        this.running = true;
        this.requestFrame(onFrame);
    }
    stop() {
        this.running = false;
        this.cancelFrames();
    }
}
exports.RafRunner = RafRunner;
