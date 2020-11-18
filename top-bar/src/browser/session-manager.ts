import { injectable } from 'inversify';

export interface UserInfo {
    success: boolean;
    username: string;
    sid: string;
    role: string;
}

@injectable()
export class SessionManager {

    private userInfo: UserInfo | undefined;
    private clipboard: string;
    private readonly clipboardMessage = 'NO COPY ALLOWED :)';

    constructor() {
        this.ping();

        document.addEventListener('copy', (e: ClipboardEvent) => {
            e.preventDefault();
            this.clipboard = e.clipboardData?.getData('text/plain') ?? '';

            e.clipboardData?.setData('text/plain', this.clipboardMessage);
            e.clipboardData?.setData('text/html', `<b>${this.clipboardMessage}</b>`);
        });

        document.addEventListener('paste', (e: ClipboardEvent) => {
            console.log(`Pasting... ${JSON.stringify(e)}`);
            console.log(`Should paste: ${this.clipboard}`);
            e.stopPropagation();
            e.preventDefault();
            e.clipboardData?.setData('text/plain', this.clipboard);
            e.clipboardData?.setData('text/html', this.clipboard);
            return false;
        });

        document.addEventListener('cut', (e: ClipboardEvent) => {
            e.preventDefault();
            this.clipboard = e.clipboardData?.getData('text/plain') ?? '';

            e.clipboardData?.setData('text/plain', this.clipboardMessage);
            e.clipboardData?.setData('text/html', `<b>${this.clipboardMessage}</b>`);
        });

    }

    async getUserInfo(): Promise<UserInfo> {
        if (this.userInfo) {
            return this.userInfo;
        }

        const res = await fetch('/services/refresh.php', {
            credentials: 'include',
        });
        const data = await res.json();
        this.userInfo = data as UserInfo;

        return this.userInfo;
    }

    private async ping() {
        const res = await fetch('/zamger/ping.php');
        const data = await res.text();

        console.log(data);

        if (data.includes("ERROR")) {
            window.location.href = '/';
            return;
        }

        this.delay(10000).then(() => this.ping());
    }

    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

}