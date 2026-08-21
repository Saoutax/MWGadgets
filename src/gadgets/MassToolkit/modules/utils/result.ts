export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export function newErrorResult<E>(e: E): Result<never, E> {
    return {
        ok: false,
        error: e,
    };
}

export function unwrap<T>(r: Result<T>): T {
    if (r.ok) {
        return r.value;
    } else {
        throw new Error('Unable to unwrap result');
    }
}

export function flatMap<T, R, E>(result: Result<T, E>, func: (t: T) => R): Result<R, E> {
    if (result.ok) {
        return {
            ok: true as const,
            value: func(result.value),
        };
    }
    return {
        ok: false as const,
        error: result.error,
    };
}
