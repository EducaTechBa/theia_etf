import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { TaskService } from '@theia/task/lib/browser';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { HomeworkSubmit } from './homework-submit';

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

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(TaskService)
    protected readonly taskService: TaskService;

    @inject(EditorManager)
    protected readonly editorManager!: EditorManager;

    @inject(HomeworkSubmit)
    protected readonly homeworkSubmit: HomeworkSubmit;

    @postConstruct()
    protected async init(): Promise<void> {
        this.id = TopBarWidget.ID;
        this.title.label = TopBarWidget.LABEL;
        this.title.caption = TopBarWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-window-maximize';

        this.editorManager.onCreated(editorWidget => this.handleEditorSwitch(editorWidget));
        this.editorManager.onActiveEditorChanged(editorWidget => this.handleEditorSwitch(editorWidget));

        this.update();
    }

    private async handleEditorSwitch(editorWidget: EditorWidget | undefined) {
        if (editorWidget !== undefined) {
            const uri = editorWidget?.getResourceUri()
            this.editorFileURI = uri;

            if(uri) {
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
        return this.renderButton({
            text: 'Run',
            tooltip: 'Run current program',
            iconClass: 'fa fa-play',
            onClick: () => this.handleRunButtonClick()
        });
    }

    private async handleRunButtonClick() {
        if (this.editorFileURI) {
            this.taskService.runTaskByLabel(0, 'C - Build and Run');
        }
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
            onClick: () => this.messageService.info("Logging out...")
        });
    }

}
