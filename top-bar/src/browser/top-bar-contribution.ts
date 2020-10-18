import { injectable, inject, postConstruct } from 'inversify';
import { MenuModelRegistry, MessageService } from '@theia/core';
import { TopBarWidget } from './top-bar-widget';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import { Command, CommandRegistry } from '@theia/core/lib/common/command';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import { WorkspaceService, WorkspaceCommands } from '@theia/workspace/lib/browser';
import { FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { MaybePromise } from '@theia/core/lib/common/types';
import { TerminalMenus, TerminalCommands } from '@theia/terminal/lib/browser/terminal-frontend-contribution';
import { DebugSessionManager } from '@theia/debug/lib/browser/debug-session-manager';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { CommonMenus } from '@theia/core/lib/browser';
import { FeedbackDialog } from './feedback-dialog';

export const TopBarCommand: Command = { id: 'top-bar:command' };

export const FeedbackCommand: Command = { id: 'feedback:command', label: 'Feedback' };

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

    @inject(MessageService)
    protected readonly messageService: MessageService;

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

        commands.registerCommand(FeedbackCommand, {
            execute: () => this.openFeedbackDialog()
        });

        const terminalCommands = Object.entries(TerminalCommands);
        terminalCommands
            .forEach(([_, cmd]: [string, Command]) =>
                commands.unregisterCommand(cmd)
            );

        const { OPEN, OPEN_FILE, OPEN_FOLDER, OPEN_WORKSPACE, OPEN_RECENT_WORKSPACE, SAVE_WORKSPACE_AS, CLOSE } = WorkspaceCommands;

        commands.unregisterCommand(OPEN);
        commands.unregisterCommand(OPEN_FILE);
        commands.unregisterCommand(OPEN_FOLDER);
        commands.unregisterCommand(OPEN_WORKSPACE);
        commands.unregisterCommand(OPEN_RECENT_WORKSPACE);
        commands.unregisterCommand(SAVE_WORKSPACE_AS);
        commands.unregisterCommand(CLOSE);
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: FeedbackCommand.id
        })

        menus.unregisterMenuNode(TerminalMenus.TERMINAL[1]);
    }

    onStart(app: FrontendApplication): MaybePromise<void> {
        if (this.workspaceService.opened) {
            this.stateService.reachedState('ready').then(
                () => this.openView({ reveal: true })
            );
        }
    }

    private async openFeedbackDialog() {
        const dialog = new FeedbackDialog();
        const res = await dialog.open();
        if(res) {
            this.messageService.info("Successfully submited feedback!");
        }
    };
}
