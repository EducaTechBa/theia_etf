import * as React from 'react';
import { inject, injectable, postConstruct } from 'inversify';
import { DialogProps } from '@theia/core/lib/browser/dialogs';
import { ReactDialog } from '@theia/core/lib/browser/dialogs/react-dialog';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { UupGameViewWidget } from './uup-game-view-widget';

export const ABOUT_CONTENT_CLASS = 'theia-aboutDialog';
export const ABOUT_EXTENSIONS_CLASS = 'theia-aboutExtensions';

@injectable()
export class GameHelpDialogProps extends DialogProps {
}

@injectable()
export class GameHelpDialog extends ReactDialog<void> {
    
    protected readonly okButton: HTMLButtonElement;
    
    private gameViewWidget : UupGameViewWidget;

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
        this.update();
    }

    protected renderAboutInfo(): React.ReactNode {
        let bugReportsURL = `https://c9.etf.unsa.ba/index.html#reportBug`;
        let instructionsManualURL = `https://docs.google.com/document/d/1avZV1n4u07jB3NNlyV3z-pqqjdyF82U8q1Yo6W8g5ss/edit`;
        let changelogURL = `/game/changelog.txt`;
        return <div className="assignment-content">
                    <span className="span">UUP Game by Mirza Mesihović</span>
                    <span className="span">Version: 1.1 - <a href={changelogURL} target="_blank">changes</a></span>
                    <span className="span">Contact: vljubovic@etf.unsa.ba</span>
                    <span className="span">Instructions on how to report bugs can be found on this &nbsp;
                    <a href={bugReportsURL} target="_blank">link</a>.</span>
                    <span>&nbsp;</span>
                    <span>&nbsp;</span>
                    <span>Additional UUP Game information</span>
                    <span>&nbsp;</span>
                    <span><a href={instructionsManualURL} target="_blank">Instructions Manual</a></span>
                    <span><input type="checkbox" onClick={() => { this.gameViewWidget.setShowRealPoints(!this.gameViewWidget.getShowRealPoints()); }} defaultChecked={this.gameViewWidget.getShowRealPoints()} /> Show real points</span>
                    <span><input type="checkbox" onClick={() => { this.gameViewWidget.setShowTime(!this.gameViewWidget.getShowTime()); }} defaultChecked={this.gameViewWidget.getShowTime()} /> Show time spent on tasks</span>
                    <span>&nbsp;</span>
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
    
    public setGameViewWidget(gameViewWidget : UupGameViewWidget): void {
        this.gameViewWidget = gameViewWidget;
    }

    get value(): undefined { return undefined; }
}
