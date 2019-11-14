import { httpListener as listener, createContext } from '@marblejs/core';
import { createServer } from 'http';
import { api, error$ } from './api';
import { RedisServer } from './lib/redis_server';
import delay = require('delay');
const port = parseInt(process.env.PORT, 10) || 3000;
const httpListener = listener({
    error$,
    effects: [api],
}).run(createContext());
export const server = createServer(httpListener).listen(port, () => {
    console.log(`Server listening @ http://0.0.0.0:${port}`);
});
export const redisServer = new RedisServer();
const exitHandler = (() => {
    let called = false;
    return async () => {
        if (called) return;
        called = true;
        console.log('shutdown imminent');
        server.close();
        redisServer.close();
        await delay(500);
        process.exit(0);
    };
})();
process.once('SIGTERM', exitHandler);
process.once('SIGINT', exitHandler);
process.once('SIGQUIT', exitHandler);
server.once('close', exitHandler);
