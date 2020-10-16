import { injectable, inject } from 'inversify';
import { MenuModelRegistry } from '@theia/core';
import { AutotestViewWidget } from './autotest-view-widget';
import { AbstractViewContribution, FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
import { Command, CommandRegistry } from '@theia/core/lib/common/command';
import { MaybePromise } from '@theia/core/lib/common/types';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import { WorkspaceService } from '@theia/workspace/lib/browser';

export const AutotestViewCommand: Command = { id: 'autotest-view:command' };

@injectable()
export class AutotestViewContribution extends AbstractViewContribution<AutotestViewWidget> implements FrontendApplicationContribution {

    @inject(FrontendApplicationStateService)
    protected readonly stateService: FrontendApplicationStateService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;


    constructor() {
        super({
            widgetId: AutotestViewWidget.ID,
            widgetName: AutotestViewWidget.LABEL,
            defaultWidgetOptions: { area: 'right' },
            toggleCommandId: AutotestViewCommand.id
        });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(AutotestViewCommand, {
            execute: () => super.openView({ activate: true, reveal: true })
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        super.registerMenus(menus);
    }

    onStart(app: FrontendApplication): MaybePromise<void> {
        if (this.workspaceService.opened) {
            this.stateService.reachedState('ready').then(
                () => this.openView({ activate: false, reveal: false })
            );
        }
    }
}
