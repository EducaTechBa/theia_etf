import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';

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

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @postConstruct()
    protected async init(): Promise<void> {
        this.id = TopBarWidget.ID;
        this.title.label = TopBarWidget.LABEL;
        this.title.caption = TopBarWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-window-maximize';
        this.update();
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
            onClick: () => this.messageService.info("Run button pressed...")
        });
    }

    private renderSubmitButton(): React.ReactNode {
        return this.renderButton({
            text: 'Submit',
            tooltip: 'Submit current homework program',
            iconClass: 'fa fa-envelope',
            onClick: () => this.messageService.info("Submit button pressed...")
        });
    }

    private renderLogoutButton(): React.ReactNode {
        return this.renderButton({
            text: 'Log Out',
            iconClass: 'fa fa-sign-out',
            onClick: () => this.messageService.info("Logging out...")
        });
    }

}
