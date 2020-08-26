import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { FileSystem } from '@theia/filesystem/lib/common';
import { Autotester, AutotesterState, Program } from './autotester';
import URI from '@theia/core/lib/common/uri';

interface SimpleTestResult {
    id: string;
    success: boolean;
    status: number;
};

@injectable()
export class AutotestViewWidget extends ReactWidget {

    static readonly ID = 'autotest-view:widget';
    static readonly LABEL = 'Autotest';

    private currentProgramDirectoryURI: string | undefined = undefined;
    private state: AutotesterState = { programs: {} };
    private currentAutotestResults: SimpleTestResult[] = [];
    private currentProgramMessage: string = "";

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

        this.editorManager.onCreated(editorWidget => this.handleEditorSwitch(editorWidget));
        this.editorManager.onActiveEditorChanged(editorWidget => this.handleEditorSwitch(editorWidget));
    }

    private async handleEditorSwitch(editorWidget: EditorWidget | undefined) {
        if (!editorWidget) {
            return;
        }
        const uri = editorWidget.getResourceUri()?.parent.toString();
        if (this.currentProgramDirectoryURI === uri) {
            return;
        }

        this.setCurrentProgramDirectoryURI(uri);

        const autotestFile = await this.loadAutotestFile(this.currentProgramDirectoryURI ?? '');
        if(!autotestFile) {
            this.currentAutotestResults = [];
            this.setCurrentProgramMessage("No autotests defined.");
            return;
        }

        try {
            const content = await this.loadAutotestResultsFile(this.currentProgramDirectoryURI || '')
            const results = JSON.parse(content);
            const testResults = Object.entries(results.test_results);
            this.currentAutotestResults = testResults.map(([id, testResult]) => {
                const { success, status } = testResult as SimpleTestResult;
                return {
                    id, success, status,
                };
            });
            this.clearCurrentProgramMessage();
        } catch (err) {
            this.currentAutotestResults = [];
            this.setCurrentProgramMessage(err);
        }
    }

    private setCurrentProgramDirectoryURI(uri: string | undefined) {
        if (typeof uri === "string") {
            this.currentProgramDirectoryURI = uri;
        }
    }

    private setCurrentProgramMessage(message: string | undefined) {
        this.currentProgramMessage = message ?? '';
        this.update();
    }

    private clearCurrentProgramMessage() {
        this.currentProgramMessage = '';
        this.update();
    }

    protected render(): React.ReactNode {
        // TODO: When the current editor is switched,
        //       show the status of the assignment in focus???
        //       Load the results from .at_results file...
        return <div id='widget-container'>
            <button
                className="theia-button run-tests-button"
                onClick={() => this.handleRunTests()}
            >
                Run tests
            </button>
            <span>{this.currentProgramMessage}</span>
            <ul className="test-list">
                {this.currentAutotestResults.map(result => this.renderTestResultItem(result))}
            </ul>
        </div>
    }

    private renderTestResultItem(result: SimpleTestResult): React.ReactNode {
        return <li key={result.id}>
            <span>{`Test ${result.id}`}</span>
            <span>{result.success}</span> |
            <span>{result.status}</span>
        </li>
    }

    // TODO: Disable the 'Run Tests' button for current program
    //       while tests are running...
    private handleRunTests() {
        this.runTests()
            .catch(msg => {
                this.messageService.info(msg);
            });
    }

    // private delay(ms: number) {
    //     return new Promise(resolve => setTimeout(resolve, ms));
    // }

    // private async getResults(programID: string) {
    //     const result = await this.autotester.getResults(programID);
    //     // Update program.state
    //     await this.delay(500);
    //     // Pozovi opet getResutls ako nije gotovo testiranje...
    // }

    private async runTests() {
        this.clearCurrentProgramMessage();

        if (!this.currentProgramDirectoryURI) {
            this.setCurrentProgramMessage("Please select a source file to test.")
            return;
        }

        const dirURI = this.currentProgramDirectoryURI;

        const autotestContent = await this.loadAutotestFile(dirURI);
        if (!autotestContent) {
            this.setCurrentProgramMessage("No autotests defined.");
            return;
        }

        const autotest = JSON.parse(autotestContent);

        const taskID = await this.autotester.setTask(autotest);
        console.log(`Task ID: ${taskID}`);

        let program = this.getProgram(dirURI);
        if (!program) {
            program = await this.createProgram(taskID);
        }
        const programID = program.id;
        console.log(`Program ID: ${programID}`);

        const dir = await this.fileSystem.getFileStat(dirURI);
        if (!dir || !dir.isDirectory) {
            this.setCurrentProgramMessage("An error occured while attempting to run tests.");
            return;
        }
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
        this.setCurrentProgramMessage("Testing...");
    }

    private async createProgram(taskID: string): Promise<Program> {
        const id = await this.autotester.setProgram(taskID);
        return {
            id,
            status: 'queue'
        };
    }

    private getProgram(dirURI: string): Program {
        return this.state.programs[dirURI];
    }

    private async loadAutotestFile(dirURI: string): Promise<string | undefined> {
        try {
            const autotestURI = `${dirURI}/.autotest2`;
            const autotestFile = await this.fileSystem.resolveContent(autotestURI);
            const autotestContent = autotestFile.content;
            return autotestContent;
        } catch (_) {
            return undefined;
        }
    }

    public async writeAutotestResultsFile() {
        // TODO: Implement
    }

    public async loadAutotestResultsFile(dirURI: string): Promise<string> {
        // TODO: Implement
        try {
            const file = await this.fileSystem.resolveContent(`${dirURI}/.at_results`);
            return file.content;
        } catch (_) {
            throw "No autotest results.";
        }
    }

}
