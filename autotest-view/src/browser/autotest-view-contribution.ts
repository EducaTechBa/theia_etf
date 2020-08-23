import { injectable } from 'inversify';
import { MenuModelRegistry } from '@theia/core';
import { AutotestViewWidget } from './autotest-view-widget';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import { Command, CommandRegistry } from '@theia/core/lib/common/command';

export const AutotestViewCommand: Command = { id: 'autotest-view:command' };

@injectable()
export class AutotestViewContribution extends AbstractViewContribution<AutotestViewWidget> {

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
}
