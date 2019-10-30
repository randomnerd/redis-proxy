import { HttpEffect, use, HttpError } from '@marblejs/core';
import { requestValidator$, t } from '@marblejs/middleware-io';
import { mergeMap, map } from 'rxjs/operators';
import { CachedFn, redisPool } from '../lib';
import delay from 'delay';
import Debug from 'debug';
const debug = Debug('redis-pool');

const validator$ = requestValidator$({
    params: t.type({ key: t.string }),
});

export async function redisGet(key: string): Promise<any> {
    const redis = await redisPool.acquire();
    const data = await redis.get(key);
    await redisPool.destroy(redis);
    if (data === null) throw new HttpError('Key not found', 404);
    return data;
}

const cachedRedisGet = new CachedFn(redisGet);
export const redisGet$: HttpEffect = req$ => req$.pipe(
    use(validator$),
    map(req => req.params.key),
    mergeMap(key => cachedRedisGet.run([key])),
    map(({ value: body, cached }) => ({
        body,
        headers: { 'X-Cached-Reply': cached.toString() },
    })),
);
