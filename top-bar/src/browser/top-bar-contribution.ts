import { injectable, inject, postConstruct } from 'inversify';
import { MenuModelRegistry } from '@theia/core';
import { TopBarWidget } from './top-bar-widget';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import { Command, CommandRegistry } from '@theia/core/lib/common/command';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { MaybePromise } from '@theia/core/lib/common/types';
import { TerminalMenus, TerminalCommands } from '@theia/terminal/lib/browser/terminal-frontend-contribution';
import { DebugSessionManager } from '@theia/debug/lib/browser/debug-session-manager';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';

export const TopBarCommand: Command = { id: 'top-bar:command' };

@injectable()
export class TopBarContribution extends AbstractViewContribution<TopBarWidget> implements FrontendApplicationContribution {

    @inject(FrontendApplicationStateService)
    protected readonly stateService: FrontendApplicationStateService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(DebugSessionManager)
    protected readonly debugSessionManager: DebugSessionManager;

    @inject(TerminalService)
    protected readonly terminalService: TerminalService;

    constructor() {
        super({
            widgetId: TopBarWidget.ID,
            widgetName: TopBarWidget.LABEL,
            defaultWidgetOptions: { area: 'top' },
            toggleCommandId: TopBarCommand.id
        });
    }

    @postConstruct()
    // @ts-ignore
    private init() {
        this.debugSessionManager.onDidDestroyDebugSession(debugSession => {
            this.terminalService.all.forEach(terminalWidget => {
                if (terminalWidget.title.label.includes('cppdbg')) {
                    terminalWidget.close();
                }
            })
        });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(TopBarCommand, {
            execute: () => super.openView({ reveal: true })
        });

        const terminalCommands = Object.entries(TerminalCommands);
        terminalCommands
            .forEach(([_, cmd]: [string, Command]) =>
                commands.unregisterCommand(cmd)
            );
    }

    registerMenus(menus: MenuModelRegistry): void {
        super.registerMenus(menus);

        menus.unregisterMenuNode(TerminalMenus.TERMINAL[1]);
    }

    onStart(app: FrontendApplication): MaybePromise<void> {
        if (this.workspaceService.opened) {
            this.stateService.reachedState('ready').then(
                () => this.openView({ reveal: true })
            );
        }
    }
}
