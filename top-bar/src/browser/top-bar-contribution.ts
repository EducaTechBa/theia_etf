import { injectable, inject, postConstruct } from 'inversify';
import { MenuModelRegistry } from '@theia/core';
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
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { EditorManager } from '@theia/editor/lib/browser';
import { OpenerService, open } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { MessageService } from '@theia/core/lib/common/message-service';
import { CommonMenus } from '@theia/core/lib/browser/common-frontend-contribution';

export const TopBarCommand: Command = { id: 'top-bar:command' };

export namespace NewFileCommands {
    export const NEW_C_FILE: Command = {
        id: 'file.newCFile',
        label: 'New C Program',
        category: 'File'
    };
    export const NEW_CPP_FILE: Command = {
        id: 'file.newCppFile',
        label: 'New C++ Program',
        category: 'File'
    };
    export const NEW_PYTHON_FILE: Command = {
        id: 'file.newPythonFile',
        label: 'New Python Program',
        category: 'File'
    };
    export const NEW_JS_FILE: Command = {
        id: 'file.newJsFile',
        label: 'New JavaScript (nodejs) Program',
        category: 'File'
    };
    export const NEW_PHP_FILE: Command = {
        id: 'file.newPhpFile',
        label: 'New PHP Program',
        category: 'File'
    };
}

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

    @inject(FileService)
    protected readonly fileService: FileService;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

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

    /** Terminal ids that existed before the current debug session started. */
    private terminalsBeforeDebug: Set<string> = new Set();

    /** Debug terminals whose input has been locked after their session ended. */
    private lockedDebugTerminals: Set<string> = new Set();

    /**
     * Enables or disables keyboard input of a terminal while keeping its output visible.
     * Programmatic input (sendText/executeCommand, used by the debugger) is not affected.
     * Relies on Theia/xterm internals: the `isAttachedCloseListener` flag gates forwarding of typed
     * data to the backend in TerminalWidgetImpl, and xterm's `disableStdin` ignores keys and paste.
     */
    private setTerminalInputEnabled(terminal: unknown, enabled: boolean): void {
        const widget = terminal as { isAttachedCloseListener?: boolean; term?: { options?: { disableStdin?: boolean } } };
        widget.isAttachedCloseListener = !enabled;
        if (widget.term?.options) {
            widget.term.options.disableStdin = !enabled;
        }
    }

    private closeLockedDebugTerminals(): void {
        this.terminalService.all
            .filter(t => this.lockedDebugTerminals.has(t.id))
            .forEach(t => t.close());
        this.lockedDebugTerminals.clear();
    }

    @postConstruct()
    // @ts-ignore
    private init() {
        // Debug adapters run the debuggee in an integrated terminal (runInTerminal). When the
        // program ends, that terminal falls back to an interactive shell prompt, which we do not
        // want students to use. Keep the output visible (like the Run button does) but lock the
        // terminal's input when the last debug session ends. The locked terminal is closed when
        // the next debug session starts, so terminals do not accumulate.
        this.debugSessionManager.onWillStartDebugSession(() => {
            if (this.debugSessionManager.sessions.length > 0) {
                return;
            }
            this.closeLockedDebugTerminals();
            this.terminalsBeforeDebug = new Set(this.terminalService.all.map(t => t.id));
        });
        this.debugSessionManager.onDidDestroyDebugSession(() => {
            this.terminalService.all.forEach(terminalWidget => {
                if (terminalWidget.title.label.includes('cppdbg')) {
                    terminalWidget.close();
                }
            });
            if (this.debugSessionManager.sessions.length > 0) {
                return;
            }
            // Titles differ per adapter/configuration, so identify the debug terminals as those
            // created since the session started.
            this.terminalService.all
                .filter(t => !this.terminalsBeforeDebug.has(t.id))
                .forEach(t => {
                    this.setTerminalInputEnabled(t, false);
                    this.lockedDebugTerminals.add(t.id);
                });
        });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(TopBarCommand, {
            execute: () => super.openView({ reveal: true })
        });

        // Register new file commands
        commands.registerCommand(NewFileCommands.NEW_C_FILE, {
            execute: () => this.createNewFile('c', this.getCTemplate())
        });

        commands.registerCommand(NewFileCommands.NEW_CPP_FILE, {
            execute: () => this.createNewFile('cpp', this.getCppTemplate())
        });

        commands.registerCommand(NewFileCommands.NEW_PYTHON_FILE, {
            execute: () => this.createNewFile('py', this.getPythonTemplate())
        });
        
        commands.registerCommand(NewFileCommands.NEW_JS_FILE, {
            execute: () => this.createNewFile('js', this.getJsTemplate())
        });
        
        commands.registerCommand(NewFileCommands.NEW_PHP_FILE, {
            execute: () => this.createNewFile('php', this.getPhpTemplate())
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
        super.registerMenus(menus);

        // Register new file menu items under File > New
        menus.registerMenuAction(CommonMenus.FILE_NEW, {
            commandId: NewFileCommands.NEW_C_FILE.id,
            label: NewFileCommands.NEW_C_FILE.label,
            order: '0'
        });

        menus.registerMenuAction(CommonMenus.FILE_NEW, {
            commandId: NewFileCommands.NEW_CPP_FILE.id,
            label: NewFileCommands.NEW_CPP_FILE.label,
            order: '1'
        });

        menus.registerMenuAction(CommonMenus.FILE_NEW, {
            commandId: NewFileCommands.NEW_PYTHON_FILE.id,
            label: NewFileCommands.NEW_PYTHON_FILE.label,
            order: '2'
        });

        menus.registerMenuAction(CommonMenus.FILE_NEW, {
            commandId: NewFileCommands.NEW_JS_FILE.id,
            label: NewFileCommands.NEW_JS_FILE.label,
            order: '3'
        });

        menus.registerMenuAction(CommonMenus.FILE_NEW, {
            commandId: NewFileCommands.NEW_PHP_FILE.id,
            label: NewFileCommands.NEW_PHP_FILE.label,
            order: '4'
        });

        // Unregister the terminal menu
        menus.unregisterMenuAction(TerminalMenus.TERMINAL[1]);
    }

    onStart(app: FrontendApplication): MaybePromise<void> {
        this.stateService.reachedState('ready').then(() => {
            this.openView({ activate: false, reveal: true });

            // Clean up old terminals on startup to prevent memory issues
            this.cleanupOldTerminals();
        });
    }

    private cleanupOldTerminals() {
        try {
            const allTerminals = this.terminalService.all;
            const MAX_TERMINALS_ON_STARTUP = 5;

            if (allTerminals.length > MAX_TERMINALS_ON_STARTUP) {
                console.log(`Found ${allTerminals.length} terminals on startup, closing oldest terminals...`);

                // Sort by creation time (oldest first) and close all but the most recent MAX_TERMINALS_ON_STARTUP
                const sortedTerminals = [...allTerminals].sort((a, b) => {
                    // Terminals don't have timestamps, so we use their order
                    return 0; // Keep original order (oldest first)
                });

                const terminalsToClose = sortedTerminals.slice(0, allTerminals.length - MAX_TERMINALS_ON_STARTUP);

                terminalsToClose.forEach(terminal => {
                    try {
                        console.log(`Closing old terminal: ${terminal.title.label}`);
                        terminal.dispose();
                    } catch (err) {
                        console.error(`Error closing terminal ${terminal.title.label}:`, err);
                    }
                });

                console.log(`Closed ${terminalsToClose.length} old terminals, ${MAX_TERMINALS_ON_STARTUP} remaining`);
            } else {
                console.log(`Found ${allTerminals.length} terminals on startup (within limit)`);
            }
        } catch (err) {
            console.error('Error during terminal cleanup:', err);
        }
    }

    private async createNewFile(extension: string, template: string): Promise<void> {
        const workspaceRoot = this.workspaceService.workspace?.resource;
        if (!workspaceRoot) {
            this.messageService.error('No workspace is open');
            return;
        }

        // Get the currently focused editor's directory, or use workspace root
        let targetDirectory = workspaceRoot;
        const currentEditor = this.editorManager.currentEditor;
        if (currentEditor) {
            const currentFileUri = currentEditor.getResourceUri();
            if (currentFileUri) {
                targetDirectory = currentFileUri.parent;
            }
        }

        // Generate a unique filename
        let counter = 1;
        let filename = `untitled.${extension}`;
        let fileUri = targetDirectory.resolve(filename);

        // Check if file exists and increment counter if needed
        while (await this.fileExists(fileUri)) {
            filename = `untitled${counter}.${extension}`;
            fileUri = targetDirectory.resolve(filename);
            counter++;
        }

        try {
            // Create the file with template content
            await this.fileService.create(fileUri, template);

            // Open the file in the editor
            await open(this.openerService, fileUri);

            this.messageService.info(`Created ${filename}`);
        } catch (err) {
            console.error('Error creating new file:', err);
            this.messageService.error(`Failed to create file: ${err}`);
        }
    }

    private async fileExists(uri: URI): Promise<boolean> {
        try {
            await this.fileService.resolve(uri);
            return true;
        } catch {
            return false;
        }
    }

    private getCTemplate(): string {
        return `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}
`;
    }

    private getCppTemplate(): string {
        return `#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}
`;
    }

    private getPythonTemplate(): string {
        return `#!/usr/bin/env python3

def main():
    print("Hello, World!")

if __name__ == "__main__":
    main()
`;
    }

    private getJsTemplate(): string {
        return `#!/usr/bin/env node
console.log("Hello World");
`;
    }

    private getPhpTemplate(): string {
        return `<?php
echo "Hello, World!\n";
?>
`;
    }
}
