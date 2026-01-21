// Stub: Firebase errors
export class FirebaseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FirebaseError';
    }
}
