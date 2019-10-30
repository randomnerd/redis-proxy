import IORedis, { Redis, RedisOptions } from 'ioredis';
import Pool, { Options as PoolOptions, Factory } from 'generic-pool';
import pEvent from 'p-event';

const defaultPoolOptions: PoolOptions = {
    min: parseInt(process.env.MIN_CONN, 10) || 0,
    max: parseInt(process.env.MAX_CONN, 10) || 5,
};
const defaultRedisOptions: RedisOptions = {
    keepAlive: 60 * 1000,
    enableReadyCheck: true,
    showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
};

export const RedisPool = (
    redisOptions: RedisOptions = defaultRedisOptions,
    poolOptions: PoolOptions = defaultPoolOptions,
): Pool.Pool<Redis> => {
    const factory: Factory<Redis> = {
        async create(): Promise<Redis> {
            const redis = new IORedis(redisOptions);
            await pEvent(redis, 'ready');
            return redis;
        },
        async destroy(redis: Redis) {
            await redis.quit();
        },
    };
    return Pool.createPool(factory, poolOptions);
};
export const redisPool = RedisPool({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
});
