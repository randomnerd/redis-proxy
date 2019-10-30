import { server } from '.';
import delay from 'delay';
import IORedis, { Redis } from 'ioredis';
import { agent } from 'supertest';
import pEvent from 'p-event';

let redis: Redis;
const request = agent(server);

beforeAll(async () => {
    process.env.CACHE_CAPACITY = '1';
    process.env.CACHE_TTL = '1';
    redis = new IORedis();
    await pEvent(redis, 'ready');
    await Promise.all([
        redis.set('foo', 'bar'),
        redis.set('bar', 'baz'),
    ]);
});
describe('Redis', () => {
    test('Get data from redis', done => {
        request.get('/foo')
            .expect('Content-Type', /application\/json/)
            .expect(200)
            .expect('X-Cached-Reply', 'false')
            .end((err, res) => {
                expect(err).toBeFalsy();
                expect(res.body).toBe('bar');
                done();
            });
    });
    test('Cached data being evicted when capacity is full', async (done) => {
        await request.get('/bar');
        request.get('/foo')
            .expect('Content-Type', /application\/json/)
            .expect('X-Cached-Reply', 'false')
            .end((err, res) => {
                expect(err).toBeFalsy();
                expect(res.body).toBe('bar');
                done();
            });
    });
    test('Get cached data from redis', async (done) => {
        await redis.del('foo');
        expect(await redis.get('foo')).toBeNull();
        request.get('/foo')
            .expect('Content-Type', /application\/json/)
            .expect('X-Cached-Reply', 'true')
            .end((err, res) => {
                expect(err).toBeFalsy();
                expect(res.body).toBe('bar');
                done();
            });
    });
    test('Cached data expires after TTL', async (done) => {
        await delay(1000);
        request.get('/foo')
            .expect('Content-Type', /application\/json/)
            .expect('X-Cached-Reply', 'true')
            .end((err, res) => {
                expect(err).toBeFalsy();
                expect(res.body).toBe('bar');
                done();
            });
    });

    test('Non-existent key is not being cached and returns 404', done => {
        request.get('/non-existent')
            .expect('Content-Type', /application\/json/)
            .expect(404)
            .end((err, res) => {
                expect(err).toBeFalsy();
                expect(res.body).toMatch('Key not found');
                expect(res.get('X-Cached-Reply')).toBe(undefined);
                done();
            });
    });

});
afterAll(done => {
    redis.disconnect();
    server.close(done);
});
