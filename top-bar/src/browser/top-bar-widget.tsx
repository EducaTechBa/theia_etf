import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';

@injectable()
export class TopBarWidget extends ReactWidget {

    static readonly ID = 'top-bar:widget';
    static readonly LABEL = 'TopBar';

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @postConstruct()
    protected async init(): Promise < void> {
        this.id = TopBarWidget.ID;
        this.title.label = TopBarWidget.LABEL;
        this.title.caption = TopBarWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-window-maximize';
        this.update();
    }

    protected render(): React.ReactNode {
        return <div id='widget-container'>
            <button className='theia-button secondary' title='Submit Homework' onClick={_a => this.displayMessage()}>Submit</button>
        </div>
    }

    protected displayMessage(): void {
        this.messageService.info('Congratulations: TopBar Widget Successfully Created!');
    }

}
