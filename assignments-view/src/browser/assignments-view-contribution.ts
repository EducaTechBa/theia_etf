import { injectable, inject } from 'inversify';
import { MenuModelRegistry } from '@theia/core';
import { AssignmentsViewWidget } from './assignments-view-widget';
import { AbstractViewContribution, FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
import { Command, CommandRegistry } from '@theia/core/lib/common/command';
import { MaybePromise } from '@theia/core/lib/common/types';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import { WorkspaceService } from '@theia/workspace/lib/browser';


export const AssignmentsViewCommand: Command = { id: 'assignments-view:command' };

@injectable()
export class AssignmentsViewContribution extends AbstractViewContribution<AssignmentsViewWidget> implements FrontendApplicationContribution {

    @inject(FrontendApplicationStateService)
    protected readonly stateService: FrontendApplicationStateService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    constructor() {
        super({
            widgetId: AssignmentsViewWidget.ID,
            widgetName: AssignmentsViewWidget.LABEL,
            defaultWidgetOptions: { area: 'left' },
            toggleCommandId: AssignmentsViewCommand.id
        });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(AssignmentsViewCommand, {
            execute: () => super.openView({ activate: false, reveal: true })
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        super.registerMenus(menus);
    }

    onStart(app: FrontendApplication): MaybePromise<void> {
        if (this.workspaceService.opened) {
            this.stateService.reachedState('ready').then(
                () => this.openView({ activate: true, reveal: true })
            );
        }
    }
}
