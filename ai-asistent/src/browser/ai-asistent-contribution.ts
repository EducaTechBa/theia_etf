import { injectable, inject } from 'inversify';
import { MenuModelRegistry } from '@theia/core';
import { AiAsistentWidget } from './ai-asistent-widget';
import { AbstractViewContribution, FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
import { Command, CommandRegistry } from '@theia/core/lib/common/command';
import { MaybePromise } from '@theia/core/lib/common/types';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import { WorkspaceService } from '@theia/workspace/lib/browser';

export const AiAsistentCommand: Command = { id: 'ai-asistent:command' };

@injectable()
export class AiAsistentContribution extends AbstractViewContribution<AiAsistentWidget> implements FrontendApplicationContribution {

    @inject(FrontendApplicationStateService)
    protected readonly stateService: FrontendApplicationStateService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;


    constructor() {
        super({
            widgetId: AiAsistentWidget.ID,
            widgetName: AiAsistentWidget.LABEL,
            defaultWidgetOptions: { area: 'right' },
            toggleCommandId: AiAsistentCommand.id
        });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(AiAsistentCommand, {
            execute: () => super.openView({ activate: true, reveal: true })
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        super.registerMenus(menus);
    }

    onStart(app: FrontendApplication): MaybePromise<void> {
        if (this.workspaceService.opened) {
            this.stateService.reachedState('ready').then(
                () => this.openView({ activate: false, reveal: true })
            );
        }
    }
}
