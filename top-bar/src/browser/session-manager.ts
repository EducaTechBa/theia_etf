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

    // Connection state management
    private isOnline: boolean = true;
    private wasOfflineDialogShown: boolean = false;

    // Exponential backoff state for refresh
    private refreshRetryCount: number = 0;
    private readonly REFRESH_BASE_DELAY = 10000; // 10 seconds
    private readonly REFRESH_MAX_DELAY = 120000; // 2 minutes

    // Exponential backoff state for ping
    private pingRetryCount: number = 0;
    private readonly PING_BASE_DELAY = 100000; // 100 seconds
    private readonly PING_MAX_DELAY = 300000; // 5 minutes

    constructor() {
        // Listen to browser online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // Check initial state
        this.isOnline = navigator.onLine;

        if (this.isOnline) {
            this.ping();
            this.refresh();
        } else {
            console.warn('SessionManager: Starting in offline mode');
        }
    }

    private handleOnline(): void {
        console.log('SessionManager: Network connection restored');
        this.isOnline = true;
        this.wasOfflineDialogShown = false;

        // Reset retry counters when connection is restored
        this.refreshRetryCount = 0;
        this.pingRetryCount = 0;

        // Resume background tasks
        this.refresh();
        this.ping();
    }

    private handleOffline(): void {
        console.warn('SessionManager: Network connection lost');
        this.isOnline = false;

        // Don't spam the user with offline dialogs
        if (!this.wasOfflineDialogShown) {
            this.wasOfflineDialogShown = true;
            const dialog = new ConfirmDialog({
                title: 'Network connection lost',
                msg: 'Your connection to the server was lost. Please check your network connection. The IDE will automatically reconnect when the connection is restored.',
                ok: 'Ok'
            });
            dialog.open();
        }
    }

    /**
     * Calculate exponential backoff delay with jitter
     */
    private calculateBackoff(retryCount: number, baseDelay: number, maxDelay: number): number {
        // Exponential: baseDelay * 2^retryCount
        const exponentialDelay = Math.min(maxDelay, baseDelay * Math.pow(2, retryCount));

        // Add jitter (randomize between 50% and 100% of calculated delay)
        // This prevents thundering herd when many clients reconnect at once
        const jitter = 0.5 + Math.random() * 0.5;

        return Math.floor(exponentialDelay * jitter);
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
        // IMPORTANT: Even if offline, we need to try refresh periodically
        // because "offline" might actually be an IP address change (backend blocking new IP)
        // Only skip if we're truly offline (no network at all)
        if (!this.isOnline) {
            console.log('SessionManager: Attempting refresh despite offline status (checking for IP change)');
            // Continue - don't return early
        }

        try {
            const res = await fetch('/api/v1/refresh');
            const data = await res.json();

            // Success! Reset retry counter
            this.refreshRetryCount = 0;

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

            // Schedule next refresh with base delay (success case)
            this.delay(this.REFRESH_BASE_DELAY).then(() => this.refresh());
         } catch(e) {
            console.warn("SessionManager: Refresh failed", e);

            // Increment retry counter
            this.refreshRetryCount++;

            // Calculate backoff delay
            const backoffDelay = this.calculateBackoff(
                this.refreshRetryCount,
                this.REFRESH_BASE_DELAY,
                this.REFRESH_MAX_DELAY
            );

            console.log(`SessionManager: Retrying refresh in ${backoffDelay}ms (attempt ${this.refreshRetryCount})`);

            // Check if we might be offline (browser doesn't always detect this immediately)
            if (!navigator.onLine && this.isOnline) {
                this.handleOffline();
            }

            // Schedule retry with exponential backoff
            this.delay(backoffDelay).then(() => this.refresh());
         }
    }

    private async ping() {
        if (!this.isOnline) {
            console.log('SessionManager: Attempting ping despite offline status (checking for IP change)');
            return;
        }

        try {
            const res = await fetch('/api/v1/zamger/ping');

            // Success! Reset retry counter
            this.pingRetryCount = 0;

            if (res.status == 200) {
                // Schedule next ping with base delay (success case)
                this.delay(this.PING_BASE_DELAY).then(() => this.ping());
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
            console.warn("SessionManager: Ping failed", e);

            // Increment retry counter for exponential backoff
            this.pingRetryCount++;

            // Calculate backoff delay
            const backoffDelay = this.calculateBackoff(
                this.pingRetryCount,
                this.PING_BASE_DELAY,
                this.PING_MAX_DELAY
            );

            console.log(`SessionManager: Retrying ping in ${backoffDelay}ms (attempt ${this.pingRetryCount})`);

            // Check if we might be offline (browser doesn't always detect this immediately)
            if (!navigator.onLine && this.isOnline) {
                this.handleOffline();
            }

            // Schedule retry with exponential backoff
            this.delay(backoffDelay).then(() => this.ping());
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
