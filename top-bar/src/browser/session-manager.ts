import { injectable } from 'inversify';

// {"success":true,"message":"You are logged in","username":"rfejzic1","sid":"pvrgajjkt7otdcootbc897bq96","role":"admin"}

export interface UserInfo {
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

        this.delay(60000).then(() => {
            console.log("60000 ms later");
            this.ping();
        });
    }

    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

}