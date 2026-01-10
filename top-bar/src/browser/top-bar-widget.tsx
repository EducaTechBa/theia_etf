import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { HomeworkSubmit } from './homework-submit';
import { TaskRunner } from './task-runner';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';

interface TopBarButtonProps {
    text: string;
    tooltip?: string;
    classNames?: string;
    iconClass?: string;
    onClick: Function
}

@injectable()
export class TopBarWidget extends ReactWidget {

    static readonly ID = 'top-bar:widget';
    static readonly LABEL = 'TopBar';

    private editorFileURI: URI | undefined;
    private isHomeworkAssignment: boolean = false;
    private isTaskRunning: boolean = false;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(EditorManager)
    protected readonly editorManager!: EditorManager;

    @inject(HomeworkSubmit)
    protected readonly homeworkSubmit: HomeworkSubmit;

    @inject(TaskRunner)
    protected readonly taskRunner: TaskRunner;

    @inject(TerminalService)
    protected readonly terminalService: TerminalService;

    @postConstruct()
    protected async init(): Promise<void> {
        this.id = TopBarWidget.ID;
        this.title.label = TopBarWidget.LABEL;
        this.title.caption = TopBarWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-window-maximize';

        // Initialize with current active editor if one exists
        const currentEditor = this.editorManager.currentEditor;
        if (currentEditor) {
            console.log('TopBar: Initializing with current active editor:', currentEditor.getResourceUri()?.toString());
            this.handleEditorSwitch(currentEditor);
        } else {
            console.log('TopBar: No active editor at initialization');
        }

        this.editorManager.onCreated(editorWidget => this.handleEditorSwitch(editorWidget));
        this.editorManager.onActiveEditorChanged(editorWidget => this.handleEditorSwitch(editorWidget));

        // Set up callback for task state changes
        this.taskRunner.setOnTaskStateChangeCallback((isRunning: boolean) => {
            this.isTaskRunning = isRunning;
            this.update();
        });

        this.update();
    }

    private async handleEditorSwitch(editorWidget: EditorWidget | undefined) {
        if (editorWidget !== undefined) {
            const uri = editorWidget?.getResourceUri()
            this.editorFileURI = uri;

            if (uri) {
                this.isHomeworkAssignment = await this.homeworkSubmit.isHomeworkAssignment(uri.parent.toString());
            } else {
                this.isHomeworkAssignment = false;
            }

            this.update();
        }
    }

    protected render(): React.ReactNode {
        return <div id='top-bar-container'>
            <span>
                {this.renderRunButton()}
                {this.renderSubmitButton()}
            </span>
            {this.renderLogoutButton()}
        </div>
    }

    protected renderButton(props: TopBarButtonProps): React.ReactNode {
        return <button
            className={`theia-button secondary ${props.classNames ?? ''}`}
            title={props.tooltip ?? props.text}
            onClick={event => props.onClick(event)}>
            {props.iconClass && <i className={`button-icon ${props.iconClass}`} aria-hidden="true"></i>}
            {props.text}
        </button>
    }

    private renderRunButton(): React.ReactNode {
        if (this.isTaskRunning) {
            return this.renderButton({
                text: 'Stop',
                tooltip: 'Stop running program',
                iconClass: 'fa fa-stop',
                classNames: 'stop-button',
                onClick: () => this.handleStopButtonClick()
            });
        } else {
            return this.renderButton({
                text: 'Run',
                tooltip: 'Run current program',
                iconClass: 'fa fa-play',
                onClick: () => this.handleRunButtonClick()
            });
        }
    }

    private async handleRunButtonClick() {
        if (this.editorFileURI) {
            this.taskRunner.runTask(this.editorFileURI);
        } else {
            console.warn('TopBar: Run button clicked but no file is open');
            this.messageService.warn('Please open a file to run');
        }
    }

    private async handleStopButtonClick() {
        await this.taskRunner.stopTask();
    }

    private renderSubmitButton(): React.ReactNode {
        return this.renderButton({
            text: 'Submit',
            tooltip: 'Submit current homework program',
            iconClass: 'fa fa-envelope',
            classNames: this.isHomeworkAssignment ? '' : 'not-homework',
            onClick: () => this.handleSubmitButtonClick()
        });
    }

    private async handleSubmitButtonClick() {
        if (this.editorFileURI === undefined) {
            return;
        }

        const dirURI = this.editorFileURI.parent.toString();
        await this.homeworkSubmit.submitHomework(dirURI);
    }

    private renderLogoutButton(): React.ReactNode {
        return this.renderButton({
            text: 'Log Out',
            iconClass: 'fa fa-sign-out',
            onClick: () => this.handleLogoutButtonClick()
        });
    }

    private async handleLogoutButtonClick() {
        // Close all terminals before logout to prevent accumulation
        console.log('Closing all terminals before logout...');
        this.closeAllTerminals();

        await fetch('/api/v1/stop');
        await fetch('/api/v1/logout');
        window.location.href = '/';
    }

    private closeAllTerminals() {
        try {
            const allTerminals = this.terminalService.all;
            console.log(`Closing ${allTerminals.length} terminals...`);

            allTerminals.forEach(terminal => {
                try {
                    console.log(`Closing terminal: ${terminal.title.label}`);
                    terminal.dispose();
                } catch (err) {
                    console.error(`Error closing terminal ${terminal.title.label}:`, err);
                }
            });
        } catch (err) {
            console.error('Error closing terminals:', err);
        }
    }

}
