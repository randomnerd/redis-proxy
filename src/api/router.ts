import { combineRoutes, EffectFactory } from '@marblejs/core';
import { notFound$, redisGet$ } from '../effects';

export type HttpVerb = 'POST' | 'PUT' | 'PATCH' | 'GET' | 'HEAD' | 'DELETE' | 'CONNECT' | 'OPTIONS' | 'TRACE' | '*';
export const match = (query: string, verb: HttpVerb) => {
    return EffectFactory.matchPath(query).matchType(verb);
};
export const redisGet = match('/:key', 'GET').use(redisGet$);
export const notFound = match('*', '*').use(notFound$);
export const api = combineRoutes('/', [redisGet, notFound]);
