import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';

@injectable()
export class AutotestViewWidget extends ReactWidget {

    static readonly ID = 'autotest-view:widget';
    static readonly LABEL = 'Autotest';

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @postConstruct()
    protected async init(): Promise < void> {
        this.id = AutotestViewWidget.ID;
        this.title.label = AutotestViewWidget.LABEL;
        this.title.caption = AutotestViewWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-check-circle-o';
        this.update();
    }

    protected render(): React.ReactNode {
        return <div id='widget-container'>
        </div>
    }

}
