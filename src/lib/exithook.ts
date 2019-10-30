type ExitCallback = (signal: number) => void | Promise<void>;
const callbacks = new Array<ExitCallback>();
let called = false;

async function exit(signal: number, shutdown = false) {
    if (called === true) return;
    called = true;
    await Promise.all(callbacks.map(async cb => cb(signal)));
    if (shutdown === true) process.exit(128 + signal);

}

export function exitHook(callback: ExitCallback) {
    callbacks.push(callback);
    if (callbacks.length === 1) {
        process.once('exit' as any, exit);
        process.once('SIGINT', exit.bind(null, 2, true));
        process.once('SIGTERM', exit.bind(null, 15, true));

        process.on('message', message => {
            if (message === 'shutdown') exit(-128, true);
        });
    }

    return () => {
        const idx = callbacks.indexOf(callback);
        if (idx !== -1) callbacks.splice(idx, 1);
    };
}
