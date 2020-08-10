import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { TaskService } from '@theia/task/lib/browser';

@injectable()
export class RunButtonWidget extends ReactWidget {

    static readonly ID = 'run-button:widget';
    static readonly LABEL = 'RunButton Widget';

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @inject(TaskService)
    protected readonly taskService!: TaskService;

    @postConstruct()
    protected async init(): Promise < void> {
        this.id = RunButtonWidget.ID;
        this.title.label = RunButtonWidget.LABEL;
        this.title.caption = RunButtonWidget.LABEL;
        this.title.closable = false;
        this.title.iconClass = 'fa fa-window-maximize'; // example widget icon.
        this.update();
    }

    protected render(): React.ReactNode {
        return  <div id='widget-container'>
                    <button className='theia-button' title='Run main' onClick={_a => this.displayMessage()}>Run</button>
                </div>
    }

    protected displayMessage(): void {
        // What is a cache token nubmer???
        this.taskService.runTaskByLabel(0, 'Run');
    }

}
