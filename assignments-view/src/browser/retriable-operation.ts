import { injectable } from 'inversify';

@injectable()
export class RetriableOperation {

    constructor(
        private operation: Function,
        private timeoutMs: number,
    ) {}

    public async run() {
        try {
            await this.operation();
        } catch(err) {
            console.log(`Error running operation: ${err}`);
            await this.delay(this.timeoutMs);
            await this.run();
        }
    }

    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
