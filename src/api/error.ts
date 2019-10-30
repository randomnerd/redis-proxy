import { HttpErrorEffect, HttpError } from '@marblejs/core';
import { mapTo, map } from 'rxjs/operators';

export const error$: HttpErrorEffect = (req$, _res, meta) => req$.pipe(
    mapTo(meta.error || new HttpError('Unknown error', 500)),
    map(({ status, message: body }) => ({ status, body })),
);
