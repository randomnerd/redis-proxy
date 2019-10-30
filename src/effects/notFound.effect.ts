import { HttpError, HttpStatus, HttpEffect } from '@marblejs/core';
import { switchMap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const notFound$: HttpEffect = req$ => req$.pipe(
    switchMap(() =>
        throwError(new HttpError('Route not found', HttpStatus.NOT_FOUND)),
    ));
