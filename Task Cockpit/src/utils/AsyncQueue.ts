class AsyncQueue {

    private pending: Promise<void> = Promise.resolve();

    enqueue(op: () => Promise<void>): Promise<void> {
        const next = this.pending.then(op);
        this.pending = next.catch(() => { });
        return next;
    }
}

export default AsyncQueue;
