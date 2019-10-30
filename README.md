Redis proxy

App makes use of `generic-pool` and `IORedis` packages to create and maintain
a pool of redis connections.
To serve HTTP requests it spawns standard node's HTTP server which maps GET
requests to redis queries using simple FRP-styled library (https://marblejs.com/).
Any requests that do not fit requirements are going down to the 404 route.
Valid requests are channeled through my `CachedFn` module which implements
abstract function caching supporting LRU and TTL as requested.
App supports configuration via environment variables (pretty much self-explanatory):
- PORT (default 3000)
- PROXY_PORT (redis protocol, default 6333)
- REDIS_HOST (default localhost)
- REDIS_PORT (default 6379)

Run `make test` to run E2E test suite.
