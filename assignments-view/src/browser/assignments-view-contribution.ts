import { injectable } from 'inversify';
import { MenuModelRegistry } from '@theia/core';
import { AssignmentsViewWidget } from './assignments-view-widget';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import { Command, CommandRegistry } from '@theia/core/lib/common/command';

export const AssignmentsViewCommand: Command = { id: 'assignments-view:command' };

@injectable()
export class AssignmentsViewContribution extends AbstractViewContribution<AssignmentsViewWidget> {

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
}
