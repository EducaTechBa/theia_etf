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

    constructor() {
        this.ping();
    }

    async getUserInfo(): Promise<UserInfo> {
        if(this.userInfo) {
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

        if(data.includes("ERROR")) {
            window.location.href = '/';
            return;
        }

        this.delay(10000).then(() => this.ping());
    }

    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

}