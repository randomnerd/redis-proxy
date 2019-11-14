import { Observable, interval, of, fromEvent, asyncScheduler as as } from 'rxjs';
import { map, tap, observeOn } from 'rxjs/operators';
import Debug from 'debug';
const debug = Debug('operators:cached');

export const operators = {
    addCacheMeta: cache => map(v => {
        const key = JSON.stringify(v);
        return { key, value: v, cached: cache[key] };
    }),
    saveCacheOp: (cache, key) => tap(v => {
        cache[key] = v;
        debug.extend('saveCache')('CACHE SAVE for key "%s": %o', key, v);
    }),
};
export const cacheOp = (origin, cache = {}) => input => new Observable(
    output => {
        debug('INIT CACHE for "%s": %o', origin.name || origin.constructor.name, cache);
        input.pipe(operators.addCacheMeta(cache)).subscribe({
            next({ key, value, cached }) {
                if (cached !== undefined) {
                    debug('CACHE HIT for key "%s": %s', key, cached);
                    return output.next(cached);
                }
                debug('CACHE MISS', { key });
                origin(of(value))
                    .pipe(operators.saveCacheOp(cache, key))
                    .subscribe(
                        v => as.schedule(x => output.next(x), 0, v),
                        this.error,
                    );
            },
            error(err) {
                debug(err, cache);
                output.error(err);
            },
            complete() {
                output.complete();
            },
        });
    },
).pipe(observeOn(as));
