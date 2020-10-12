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

    protected renderHeader(): React.ReactNode {
        //const applicationInfo = this.applicationInfo;
        //return applicationInfo && <h3>{applicationInfo.name} {applicationInfo.version}</h3>;
        return <h3>Test</h3>
    }

    protected renderExtensions(): React.ReactNode {
        const extensionsInfos : {name: string}[] = [{name: "dick"}];
        return <>
            <h3>List of extensions</h3>

            <ul className={ABOUT_EXTENSIONS_CLASS}>
                {
                    extensionsInfos
                        .map((extension: any, index: number) => <li key={index}>Dummy text</li>)
                }
            </ul>
        </>;
    }

    protected render(): React.ReactNode {
        return <div className={ABOUT_CONTENT_CLASS}>
            {this.renderHeader()}
            {this.renderExtensions()}
        </div>;
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.update();
    }

    get value(): undefined { return undefined; }
}