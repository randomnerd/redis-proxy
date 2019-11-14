import { createServer, Socket } from 'net';
import { of, Observable } from 'rxjs';
import { getObservableByStream, pipeObservableToStream } from 'rxdable';
import { redisProxy$, redisSocket } from './operators';

export class RedisServer {
    private readonly server = createServer(c => this.handler(c));
    public readonly port = parseInt(process.env.PROXY_PORT, 10) || 6333;
    constructor(
    ) {
        this.server.listen(this.port);
    }

    close() {
        this.server.close();
    }

    encodeArray(chunks: any[]) {
        return '*' + chunks.length + '\r\n' + chunks.map(c => this.encode(c)).join();
    }

    encode(chunk: any) {
        if (Array.isArray(chunk)) return this.encodeArray(chunk);
        if (typeof chunk === 'number')
            return ':' + chunk.toString();
        if (typeof chunk === 'string')
            return chunk.match(/\s+/) ?
                '$' + chunk.length + '\r\n' + chunk + '\r\n' :
                '+' + chunk + '\r\n';
    }

    cache = {};

    async handler(socket: Socket) {
        const osock = getObservableByStream<Buffer>(socket);
        const redis = await redisSocket();
        pipeObservableToStream(osock.pipe(redisProxy$(redis)), socket);
    }

    cacheOp = (src, cache = {}) => src$ => Observable.create(proxy => {
        return src$.subscribe(
            value => {
                let result$ = '';
                const id = JSON.stringify(value);
                if (cache[id] !== undefined) return proxy.next(cache[id]);
                of(value).pipe(src).subscribe(
                    value$ => result$ += value$,
                    err => proxy.error(err),
                    () => (cache[id] = result$, proxy.next(result$)),
                );
            },
            err => proxy.error(err),
        );
    });
}
