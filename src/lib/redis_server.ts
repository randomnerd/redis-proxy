import { Parser } from 'redis/lib/parser/javascript';
import { createServer, Socket } from 'net';
import { redisPool } from './redispool';
import { map, mergeMap, catchError } from 'rxjs/operators';
import pEvent from 'p-event';
import { CachedFn } from './cachedfn';
import { of } from 'rxjs';

export class RedisServer {
    private readonly server = createServer(c => this.handler(c));
    private readonly redisPool = redisPool;
    private readonly parser = new Parser({});
    private cachedPipeline = new CachedFn(this.pipeline.bind(this));
    public port: number = parseInt(process.env.PROXY_PORT, 10) || 6333;
    constructor() {
        this.server.listen(this.port);
    }

    close() {
        this.server.close();
    }

    encodeRedis = map((chunk: any[]) => {
        const header = Buffer.from('*' + chunk.length + '\r\n');
        const data = Buffer.concat(chunk.map(i => Buffer.concat([
            Buffer.from('$' + i.length + '\r\n'),
            Buffer.isBuffer(i) ? i : Buffer.from(i.toString()),
            Buffer.from('\r\n'),
        ])));
        return Buffer.concat([header, data]);
    });

    async pipeline(source): Promise<Buffer> {
        const redis = await this.redisPool.acquire();
        return new Promise(async (resolve, reject) => of(source).pipe(
            mergeMap(data => new Promise(async (resolve, reject) => {
                (this.parser as any).on('reply', resolve);
                (this.parser as any).on('error', reject);
                this.parser.execute(data);
            })),
            mergeMap(async (decoded: any[]) => {
                const [cmd, ...args] = decoded;
                const response = await redis[cmd.toLowerCase()](...args);
                return [response.toString()];
            }),
            this.encodeRedis,
            catchError(err => reject(err) as any),
        ).subscribe(async (response: Buffer) => {
            await redisPool.destroy(redis);
            resolve(response);
        }));
    }

    async handler(socket: Socket) {
        const data = await pEvent(socket, 'data');
        const reply = await this.cachedPipeline.run([data]);
        socket.end(reply.value);
    }
}
