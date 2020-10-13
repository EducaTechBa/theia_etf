import * as React from 'react';
import { inject, injectable, postConstruct } from 'inversify';
import { DialogProps } from '@theia/core/lib/browser/dialogs';
import { ReactDialog } from '@theia/core/lib/browser/dialogs/react-dialog';
import { Message } from '@theia/core/lib/browser/widgets/widget';

export const ABOUT_CONTENT_CLASS = 'theia-aboutDialog';
export const ABOUT_EXTENSIONS_CLASS = 'theia-aboutExtensions';

@injectable()
export class GameHelpDialogProps extends DialogProps {
}

@injectable()
export class GameHelpDialog extends ReactDialog<void> {
    
    protected readonly okButton: HTMLButtonElement;

    constructor(
        @inject(GameHelpDialogProps) protected readonly props: GameHelpDialogProps
    ) {
        super({
            title: props.title,
        });
        this.appendAcceptButton('Ok');
    }

    @postConstruct()
    protected async init(): Promise<void> {
        //this.applicationInfo = await this.appServer.getApplicationInfo();
        //this.extensionsInfos = await this.appServer.getExtensionsInfos();
        this.update();
    }

    protected renderAboutInfo(): React.ReactNode {
        let bugReportsURL = `https://docs.google.com/document/d/1zIOrLJR-DVCnKffFzS6WzzKDVXEOvF8CSZWvQdj-0KA/edit?usp=sharing`;
        let instructionsManualURL = `https://www.youtube.com/watch?v=dQw4w9WgXcQ`;
        return <div className="assignment-content">
                    <span className="span">UUP Game by Mirza Mesihović</span>
                    <span className="span">Version: 1.0</span>
                    <span className="span">Contact: mmesihovic1@etf.unsa.ba</span>
                    <span className="span">Instructions on how to report bugs can be found on this &nbsp;
                    <a href={bugReportsURL} target="_blank">link</a>.</span>
                    <span>&nbsp;</span>
                    <span>&nbsp;</span>
                    <span>Additional UUP Game information</span>
                    <span>&nbsp;</span>
                    <span><a href={instructionsManualURL} target="_blank">Instructions Manual</a></span>
                    <span>&nbsp;</span>
                    <span>Formula for points on activity Game on courses UUP/OR:</span>
                    <span>(LEVEL-1)+(XP/1000)</span>
                </div>
    }

    protected renderExtensions(): React.ReactNode {
        return <div></div>
    }

    protected render(): React.ReactNode {
        return <div className='aboutDialog'>
            {this.renderAboutInfo()}
            {this.renderExtensions()}
        </div>;
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.update();
    }

    get value(): undefined { return undefined; }
}