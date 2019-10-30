import { murmurHash128x64 as hash } from 'murmurhash-native';
import Debug from 'debug';
const debug = Debug('CachedFn');

export type maybe<K> = K | null | undefined | void;

type CacheableFn = (...args: any) => any;
export class CachedFn<T> {
    static DEFAULTS: CachedFn.Options = {
        capacity: parseInt(process.env.CACHE_CAPACITY, 10) || 1,
        ttl: parseInt(process.env.CACHE_TTL, 10) || 60,
    };

    constructor(
        public fn: CacheableFn,
        public options = CachedFn.DEFAULTS,
    ) { }

    private _length = 0;
    private _head?: CachedFn.Result<T>;
    private _tail?: CachedFn.Result<T>;
    cache: CachedFn.Cache<T> = {};
    [Symbol.iterator]() { return this.iterator(); }
    get head(): maybe<T> { if (this._head) return this._head.value; }
    get tail(): maybe<T> { if (this._tail) return this._tail.value; }
    get length(): number { return this._length; }

    *iterator(): IterableIterator<T> {
        let item = this._head;
        while (item) {
            yield item.value;
            item = item.next;
        }
    }
    get(id: string) {
        return this.cache[id];
    }
    moveToHead(id: string): CachedFn.Result<T> {
        const item = this.cache[id];
        if (!item) return;
        item.next = undefined;
        item.prev = this._head;
        this._head.next = item;
        return item;
    }

    async run(args: any[] = [], context?: any): Promise<{ cached: boolean, value: any }> {
        const id = CachedFn.Result.idHash({ args, context });
        const cached = !!this.cache[id];
        const value = cached ? this.cache[id].value : await this.fn.apply(context, args);
        if (!cached && value) this.prepend({ args, context }, value);
        return { value, cached };
    }

    prepend(payload: CachedFn.Payload | CachedFn.Result<T>, value?: T): CachedFn.Result<T> {
        if (payload instanceof CachedFn.Result) {
            const result = payload as CachedFn.Result<T>;
            value = result.value;
            payload = result.payload;
        }
        if (!value) return;
        const newItem = new CachedFn.Result<T>(payload, value);
        this.cache[newItem.id] = newItem;
        if (this.options.ttl)
            setTimeout(() => this.removeItem(newItem), this.options.ttl * 1000).unref();

        if (!this._head) {
            this.singleItemList(newItem);
        } else {
            newItem.next = this._head;
            this._head.prev = this._head = newItem;
        }

        if (this._length >= this.options.capacity) this.removeTail();
        this._length++;
        return newItem;
    }

    remove(id: string): CachedFn.Result<T> {
        const item = this.cache[id];
        if (!item) return;
        if (item === this._head) {
            this._head = item.next;
        } else if (item === this._tail) {
            this._tail = item.prev;
        } else {
            if (item.prev) item.prev.next = item.next;
            if (item.next) item.next.prev = item.prev;
        }

        return this.removeItem(item);
    }

    removeHead(): CachedFn.Result<T> {
        const item = this._head;
        if (!item) return;

        if (!item.next) {
            this.singleItemList();
        } else {
            this._head.next.prev = undefined;
            this._head = this._head.next;
        }
        return this.removeItem(item);
    }

    removeTail(): CachedFn.Result<T> {
        const item = this._tail;
        if (!item) return;

        if (!this._tail.prev) {
            this.singleItemList();
        } else {
            this._tail.prev.next = undefined;
            this._tail = this._tail.prev;
        }
        return this.removeItem(item);
    }

    private singleItemList(val?: CachedFn.Result<T>) { this._head = this._tail = val; }
    private removeItem(item: CachedFn.Result<T>): CachedFn.Result<T> {
        item.next = item.prev = undefined;
        delete this.cache[item.id];
        this._length--;
        return item;
    }
}

export namespace CachedFn {
    export interface Options {
        ttl: number;
        capacity: number;
        context?: any;
    }

    export interface Payload {
        args: any[];
        context?: any;
    }

    export interface Cache<T> { [id: string]: Result<T>; }

    export class Result<T> {
        prev?: Result<T>;
        next?: Result<T>;
        static idHash(payload: Payload): string {
            return hash(JSON.stringify(payload)) as string;
        }

        constructor(
            public readonly payload: Payload,
            public readonly value: T,
            public readonly id = Result.idHash(payload),
        ) { }
    }
}
export default CachedFn;
