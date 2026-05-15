
export function deepPlain(obj: unknown): unknown {
    if (obj instanceof Set) {
        return new Set(obj);
    };
    if (obj instanceof Map) {
        return new Map(obj);
    }
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, deepPlain(v)])
    );
}
