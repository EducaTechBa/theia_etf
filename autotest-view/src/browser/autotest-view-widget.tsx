import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { EditorManager } from '@theia/editor/lib/browser';
import { FileSystem } from '@theia/filesystem/lib/common';
import { Autotester } from './autotester';

@injectable()
export class AutotestViewWidget extends ReactWidget {

    static readonly ID = 'autotest-view:widget';
    static readonly LABEL = 'Autotest';

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @inject(EditorManager)
    protected readonly editorManager!: EditorManager;

    @inject(FileSystem)
    protected readonly fileSystem!: FileSystem;

    @inject(Autotester)
    protected readonly autotester!: Autotester;

    @postConstruct()
    protected async init(): Promise<void> {
        this.id = AutotestViewWidget.ID;
        this.title.label = AutotestViewWidget.LABEL;
        this.title.caption = AutotestViewWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-check-circle-o';
        this.update();
    }

    protected render(): React.ReactNode {
        return <div id='widget-container'>
            <button onClick={() => this.handleRunTests()}>Run tests</button>
        </div>
    }

    private handleRunTests() {
        const editor = this.editorManager.currentEditor;
        if (editor) {
            const uri = editor.getResourceUri();
            if (!uri) {
                this.messageService.info("File not saved!");
                return;
            }
            const autotestFileURI = `${uri.parent}/.autotest2`;
            this.fileSystem.resolveContent(autotestFileURI)
                .then(file => {
                    const autotest = JSON.parse(file.content);
                    this.messageService.info(`Autotest ID: ${autotest.id}`);
                    this.autotester.setProgramFile("program id", "main.c", "");
                })
                .catch(err => console.log(err));
        } else {
            this.messageService.info("No file currently opened!");
        }
    }

}
