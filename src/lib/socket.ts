import debug from 'debug';
import { createConnection, Socket, SocketConnectOpts } from 'net';
import { Observable, fromEvent, Observer } from 'rxjs';

export function socketObserver(socket: Socket) {
    const queue = [];
    const log = debug('observable-socket');
    const write = _chunk => new Promise((resolve, reject) => {
        _write(_chunk, err => err ? reject(err) : resolve(true));
    });
    const _write = (data, cb?) => socket.write(data, cb);
    const flush = () => Promise.all(queue.map(write));
    const up = data => queue.push(data);
    socket.on('ready', flush);
    socket.on('drain', flush);

    // const ready: Promise<typeof write> = new Promise((resolve) => {
    //     // If we make an Observable from an already connected socket, we'll never
    //     // hear anything about 'connect' or 'ready'.
    //     if (socket.readable && socket.writable) return resolve(write);
    //     fromEvent(socket, 'ready').pipe(take(1)).subscribe(() => resolve(write));
    //     log('already opened');
    //     resolve(write);
    // });

    const down = new Observable<any>(function (observer: Observer<any>) {
        const _data = fromEvent(socket, 'data').subscribe(e => {
            log.extend('next')('data');
            observer.next(e);
        });
        const _error = fromEvent(socket, 'error').subscribe(e => {
            log('error', e);
            observer.error(e);
        });
        const _close = fromEvent(socket, 'close').subscribe(() => {
            log('closed');
            observer.complete();
        });

        return function cleanup () {
            [_close, _error, _data].forEach(s => s.unsubscribe());
        }
    });
    return { up, down };
}

export function newSocketObserver(opts: SocketConnectOpts) {
    return socketObserver(createConnection(opts));
}

const osock = newSocketObserver({ host: 'localhost', port: 6379 });

