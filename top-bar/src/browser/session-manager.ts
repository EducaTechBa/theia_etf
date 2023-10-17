import { injectable } from 'inversify';
import { ConfirmDialog } from '@theia/core/lib/browser';

export interface UserInfo {
    success: boolean;
    username: string;
    sid: string;
    role: string;
}

@injectable()
export class SessionManager {

    private userInfo: UserInfo | undefined;
    private lastAnnouncement: string | undefined;

    constructor() {
        this.ping();
        this.refresh();
    }

    async getUserInfo(): Promise<UserInfo> {
        if(this.userInfo) {
            return this.userInfo;
        }

        const res = await fetch('/api/v1/refresh', {
            credentials: 'include',
        });
        const data = await res.json();
        this.userInfo = data as UserInfo;

        return this.userInfo;
    }

    private async refresh() {
        try {
            const res = await fetch('/api/v1/refresh');
            const data = await res.json();

            if (!data.serviceActive) {
                const dialog = new ConfirmDialog({
                    title: 'Service has stopped',
                    msg: "Webide server has stopped responding. Probably you were logged out by administrator. You need to logout then login again.",
                    ok: "Ok"
                });
                let timeout = setTimeout(() => this.logout(), 60000)
                await dialog.open();
                clearTimeout(timeout);
                this.logout();
                return;
            }
            else if (!data.ipAddressOk) {
                const dialog = new ConfirmDialog({
                    title: 'Your IP address changed',
                    msg: "For security reasons, you need to login again.",
                    ok: "Ok"
                });
                let timeout = setTimeout(() => this.logout(), 60000)
                await dialog.open();
                clearTimeout(timeout);
                this.logout();
                return;
            }
            else if (res.status != 200) {
                const dialog = new ConfirmDialog({
                    title: 'Your session has expired',
                    msg: "You need to logout and log back in, otherwise you will experience various problems using webide",
                    ok: "Logout",
                    cancel: "Continue using webide"
                });
                let timeout = setTimeout(() => this.logout(), 60000)
                let confirmation = await dialog.open();
                clearTimeout(timeout);
                if (confirmation) {
                    this.logout();
                }
                return;
            }

            if (data.announcement.length > 0 && data.announcement !== this.lastAnnouncement) {
                const dialog = new ConfirmDialog({
                    title: 'System announcement',
                    msg: data.announcement,
                    ok: "Ok"
                });
                dialog.open();
                this.lastAnnouncement = data.announcement;
            }

            this.userInfo = data as UserInfo;

            this.delay(10000).then(() => this.refresh());
         } catch(e) {
            console.log("Refresh: Network error", e);
            this.delay(10000).then(() => this.refresh());
         }
    }

    private async ping() {
        try {
            const res = await fetch('/api/v1/zamger/ping');
            if (res.status == 200) {
                this.delay(100000).then(() => this.ping());
            } else {
                const dialog = new ConfirmDialog({
                    title: 'Your session has expired',
                    msg: "You need to logout and log back in, otherwise you will experience various problems using webide",
                    ok: "Logout",
                    cancel: "Continue using webide"
                });
                let confirmation = await dialog.open();
                if (confirmation) {
                    this.logout();
                    return;
                }
            }
        } catch(e) {
            console.log("Ping: Network error", e);
            this.delay(100000).then(() => this.ping());
        }
    }

    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async logout() {
        await fetch('/api/v1/stop');
        await fetch('/api/v1/logout');
        // window.location.href = '/';
        const win = window.open('','_self');
        if (win !== null) win.close();
    }
}
