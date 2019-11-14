process.env.DEBUG = '*';
import * as miss from 'mississippi';
import { Socket, createConnection } from 'net';
import Parser from 'redis-parser';
import { debug as Debug } from 'debug';
import { pipe, Observable, of, from } from 'rxjs';
import { scan, share } from 'rxjs/operators';
import { getObservableByStream } from 'rxdable';
const debug = Debug('operators:socket');

export const concatSock = (input: Socket) =>
    new Promise((ok, nok) => miss.pipe(input, miss.concat(ok), nok));

export const askSock = (sock: Socket, data) => new Promise((resolve, reject) => {
    concatSock(sock).then(data => {
        resolve(data);
    }).catch(reject);
    // if (!sock.push(data)) reject(new Error('cant push'));
});

export const parseRedis = (data: string): Promise<any[]> => new Promise((resolve, reject) => {
    const log = debug.extend('parser');
    const parser = new Parser({
        returnReply: (reply: any[]) => {
            log('>>> %o', reply);
            resolve(reply);
        },
        returnError: reject,
    });
    log('<<< %s', data);
    parser.execute(data);
});

const redisDefault = { host: 'localhost', port: 6379 };
const redisSock = (opts = redisDefault): Promise<Socket> => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout')), 1000);
    const sock = createConnection(opts).once('ready', () => resolve(sock));
    sock.setDefaultEncoding('binary');
    sock.setTimeout(1000, () => {
        sock.write();
        sock.bytesRead ? resolve(sock) : reject(new Error('timeout'));
        sock.end();
    });
});
const encodeArray = (chunks: any[]): string =>
    '*' + chunks.length + '\r\n' + chunks.map(c => encode(c)).join();

const encodeNumber = (num: number) => ':' + num.toString() + '\r\n';
const encodeSimpleString = (str: string) => '+' + str + '\r\n';
const encodeBulkString = (str: string) => '$' + str.length + '\r\n' + str + '\r\n';
const encodeString = (str: string) =>
    ['\r', '\n'].filter(i => str.includes(i)).length ?
        encodeBulkString(str) : encodeSimpleString(str);
const encodeError = (msg: string) =>
    '-' + msg.replace('\n', '').replace('\r', '') + '\r\n';

const encode = (chunk: any): string => {
    if (Array.isArray(chunk)) return encodeArray(chunk);
    if (chunk instanceof Error) return encodeError(chunk.message);
    if (typeof chunk === 'number') return encodeNumber(chunk);
    if (typeof chunk === 'string') return encodeString(chunk);
    return encodeString(JSON.stringify(chunk));
};

const decode2 = input => new Observable(output => {
    const cache = { packets: [], data: null, parsed: [] };
    const parser = new Parser({
        returnReply(reply) {
            cache.parsed.push(reply);
            output.next(reply);
            cache.data = null;
            // parser.reset();
        },
        returnError(error) { output.error(error); },
    });
    input.subscribe({
        next(value) {
            const buf = Buffer.isBuffer(value) ? value : Buffer.from(value);
            cache.packets.push(buf);
            cache.data = Buffer.isBuffer(cache.data) ? Buffer.concat([cache.data, buf]) : buf;
            parser.execute(cache.data, 0);
        },
        error(err) { output.error(err); },
        complete() {
            output.complete();
            return cache;
        },
    });
});

const encoded = encode(['command']);
const decoded = from([encoded]).pipe(decode2).toPromise().then(console.log);

const decode = () => {
    const parser = new Parser({
        returnReply(reply) { },
        returnError(error) { },
    });
    return pipe(
        scan((acc, val, idx) => {
            acc.packets++;
            acc.cache += val;
        }, { packets: 0, cache: '', result: [] }),
    );
};

// (async () => {
//     const data = encode(['command']);
//     console.log(JSON.stringify(data));
//     const sock = await redisSock();
//     const osock = getObservableByStream(sock).pipe(share());
//     osock.pipe(decode2).subscribe(v => {
//         debug("%o", v);
//     });
// })();
