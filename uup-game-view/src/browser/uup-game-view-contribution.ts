import { injectable, inject } from 'inversify';
import { MenuModelRegistry } from '@theia/core';
import { UupGameViewWidget } from './uup-game-view-widget';
import { AbstractViewContribution , FrontendApplicationContribution, FrontendApplication} from '@theia/core/lib/browser';
import { Command, CommandRegistry } from '@theia/core/lib/common/command';
import { MaybePromise } from '@theia/core/lib/common/types';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import { WorkspaceService } from '@theia/workspace/lib/browser';

export const UupGameViewCommand: Command = { id: 'uup-game-view:command' };

@injectable()
export class UupGameViewContribution extends AbstractViewContribution<UupGameViewWidget> implements FrontendApplicationContribution {

    @inject(FrontendApplicationStateService)
    protected readonly stateService: FrontendApplicationStateService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    constructor() {
        super({
            widgetId: UupGameViewWidget.ID,
            widgetName: UupGameViewWidget.LABEL,
            defaultWidgetOptions: { area: 'left' },
            toggleCommandId: UupGameViewCommand.id
        });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(UupGameViewCommand, {
            execute: () => super.openView({ activate: false, reveal: true })
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        super.registerMenus(menus);
    }

    onStart(app: FrontendApplication): MaybePromise<void> {
            this.stateService.reachedState('ready').then(
                () => this.openView({ activate: true, reveal: false })
            );
    }
}
