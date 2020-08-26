import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { EditorManager } from '@theia/editor/lib/browser';
import { FileSystem } from '@theia/filesystem/lib/common';
import { Autotester } from './autotester';
import URI from '@theia/core/lib/common/uri';

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

    // Disable test button while testing in progress???
    private async handleRunTests() {
        const currentFile = this.getCurrentEditorFile();
        if (!currentFile) {
            this.messageService.info("Please open a source file to test!");
            return;
        }

        const dirURI = currentFile.parent.toString();
        const dir = await this.fileSystem.getFileStat(dirURI);
        if (!dir || !dir.isDirectory) {
            return;
        }

        const autotestURI = `${dirURI}/.autotest2`;
        const autotestContent = await (await this.fileSystem.resolveContent(autotestURI)).content;
        const autotest = JSON.parse(autotestContent);

        const taskID = await this.autotester.setTask(autotest);
        console.log(`Task ID: ${taskID}`);

        const programID = await this.autotester.setProgram(taskID);
        console.log(`Program ID: ${programID}`);

        const filesStats = dir.children ?? [];
        const assignmentFiles = filesStats.map(file => ({
            uri: file.uri,
            name: new URI(file.uri).displayName
        }));

        const promises = assignmentFiles.map(file =>
            this.fileSystem
                .resolveContent(file.uri)
                .then(({ content }) => ({
                    ...file,
                    content
                }))
        );

        const files = await Promise.all(promises);
        this.autotester.setProgramFiles(programID, files);
        console.log("Source files are set...");
    }

    private getCurrentEditorFile(): URI | null {
        const editor = this.editorManager.currentEditor;
        if (!editor) {
            return null;
        }

        const uri = editor.getResourceUri();
        if (!uri) {
            return null;
        }

        return uri;
    }

    public async writeAutotestResultsFile() {
        // TODO: Implement
    }
    
}
