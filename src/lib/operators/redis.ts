import Parser from 'redis-parser';
import { Observable, asyncScheduler, Subscriber, of } from 'rxjs';
import { observeOn, concat } from 'rxjs/operators';
import { createConnection } from 'net';
import pEvent = require('p-event');
import { getOperatorByStream } from 'rxdable';
import * as miss from 'mississippi';
import Debug from 'debug';
const debug = Debug('operators:redis');

export const parseRedis = (data: string): Promise<any[]> => new Promise((resolve, reject) => {
    const log = debug.extend('parser');
    const parser = new Parser({
        returnReply: (reply: any[]) => {
            log('>>> %o', reply);
            resolve(reply);
        },
        returnError: reject,
        returnFatalError: reject,
    });
    log('<<< %s', data);
    parser.execute(data);
});

export const parseRedis$ = () =>
    (input: Observable<string>) =>
        new Observable<any[]>((output: Subscriber<any[]>) =>
            input.subscribe({
                next(value): Promise<any[]> {
                    return parseRedis(value).then(parsed => {
                        output.next(parsed);
                        output.complete();
                        return parsed;
                    });
                },
                error(err: Error) {
                    debug.extend('error').log(err);
                    output.error(err);
                },
            }),
        ).pipe(observeOn(asyncScheduler));

const redisDefault = { host: 'localhost', port: 6379 };
const redisSock = (opts = redisDefault) => createConnection(opts);
export const redisSocket = async (params = { host: 'localhost', port: 6379 }) => {
    const gotData = (data) => { };
    const gotError = (error) => { };
    const inputStream = createConnection(params);
    const concatStream = miss.concat(gotData);
    miss.pipe(inputStream, concatStream, gotError);

    const operator = getOperatorByStream(inputStream);
    inputStream.once('connect', () => debug('redis inputStreamected'));
    inputStream.once('close', () => debug('redis closed'));
    await pEvent(inputStream, 'connect');
    return getOperatorByStream(inputStream);
};

export const redisProxy$ = redis => (input) => Observable.create(output =>
    input.subscribe({
        next(value) {
            const log = debug.extend('proxy');
            log('>>>', value);
            const resultpipe = redis(of(value)).pipe(concat);
            resultpipe.subscribe({
                next(v) {
                    return asyncScheduler.schedule(x => output.next(x), 0, v);
                },
                complete() {
                    return output.complete();
                },
                error(err) {
                    return output.error(err);
                },
            });
        },
        error(err) {
            debug('%e', err);
            output.error(err);
        },
        complete() {
            output.complete();
        },
    })
).pipe(observeOn(asyncScheduler));
