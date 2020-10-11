import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { FileSystem } from '@theia/filesystem/lib/common';
import { AutotestService, AutotestRunStatus, Program, TestResult } from './autotest-service';

interface AutotestWidgetState {
    programDirectoryURI: string | undefined;
    autotestResults: TestResult[];
    statusMessage: string;
    progressMessage: string;
}

@injectable()
export class AutotestViewWidget extends ReactWidget {

    static readonly ID = 'autotest-view:widget';
    static readonly LABEL = 'Autotest';

    private state: AutotestWidgetState = {
        programDirectoryURI: undefined,
        autotestResults: [],
        statusMessage: '',
        progressMessage: '',
    };

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @inject(EditorManager)
    protected readonly editorManager!: EditorManager;

    @inject(FileSystem)
    protected readonly fileSystem!: FileSystem;

    @inject(AutotestService)
    protected readonly autotestService!: AutotestService;

    @postConstruct()
    protected async init(): Promise<void> {
        this.id = AutotestViewWidget.ID;
        this.title.label = AutotestViewWidget.LABEL;
        this.title.caption = AutotestViewWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-check-circle-o';
        this.update();

        this.autotestService.onTestsUpdate(autotestEvent => {
            const program = autotestEvent.program;
            this.setStateProcessing(program);
        });

        this.autotestService.onTestsFinished(autotestEvent => {
            const program = autotestEvent.program;
            if (program.uri !== this.state.programDirectoryURI) {
                return;
            }
            this.setStateFinished(this.state.programDirectoryURI);
        });

        this.editorManager.onCreated(editorWidget => this.handleEditorSwitch(editorWidget));
        this.editorManager.onActiveEditorChanged(editorWidget => this.handleEditorSwitch(editorWidget));
    }

    private setState(update: (state: AutotestWidgetState) => void) {
        update(this.state);
        this.update();
    }

    private async setStateProcessing(program: Program) {
        if (program.uri !== this.state.programDirectoryURI || program.result === undefined) {
            return;
        }

        const { completedTests, inQueue, isBeingTested } = program.result;
        const statusMessage = program.status.toString();
        const completionMessage = `Completed ${completedTests} out of ${program.totalTests} tests...`;
        const queueMessage = `${inQueue} programs awaiting execution...`;

        this.setState(state => {
            state.statusMessage = statusMessage;
            state.progressMessage = isBeingTested ? completionMessage : queueMessage;
            state.autotestResults = [];
        });
    }

    private async setStateFinished(dirURI: string) {
        const program = await this.autotestService.getProgramFromAutotestResultFile(dirURI);

        if (program === undefined || program.result === undefined) {
            this.setState(state => {
                state.autotestResults = [];
                state.statusMessage = 'This program has not been tested before.';
                state.progressMessage = '';
            });
            return;
        }

        this.setState(state => {
            state.statusMessage = program.status.toString();
            state.progressMessage = '';
            state.autotestResults = program.result?.testResults ?? [];
        });
    }

    private async handleEditorSwitch(editorWidget: EditorWidget | undefined) {
        if (!editorWidget) {
            return;
        }

        const uri = editorWidget.getResourceUri()?.parent.toString();

        if (uri === undefined || this.state.programDirectoryURI === uri) {
            return;
        }

        this.setState(state => {
            state.programDirectoryURI = uri;
        });

        if (this.state.programDirectoryURI === undefined) {
            return;
        }

        if (this.autotestService.isBeingTested(this.state.programDirectoryURI)) {
            const program = this.autotestService.getProgram(this.state.programDirectoryURI);
            if (program === undefined || program.result === undefined) {
                return;
            }

            this.setStateProcessing(program);
            return;
        }

        const hasAutotests = await this.autotestService.hasAutotestsDefined(this.state.programDirectoryURI);
        if (!hasAutotests) {
            this.setState(state => {
                state.autotestResults = [];
                state.statusMessage = 'No autotests defined.';
                state.progressMessage = '';
            });
            return;
        }

        await this.setStateFinished(this.state.programDirectoryURI);
    }

    protected render(): React.ReactNode {
        return <div id='autotests-container'>
            <button
                className="theia-button run-tests-button"
                onClick={() => this.handleRunTests()}
            >
                Run tests
            </button>
            <span>{this.state.statusMessage}</span>
            <span>{this.state.progressMessage}</span>
            <ul className="test-list">
                {this.state.autotestResults.map(result => this.renderTestResultItem(result))}
            </ul>
        </div>
    }

    // TODO: Add onClick handler to open the details view!!!
    //       Try to open the view in a new tab or, if it must be, a new window
    private renderTestResultItem(result: TestResult): React.ReactNode {
        return <li
            key={result.id}
            className={`test-result ${result.success ? 'test-success' : 'test-fail'}`}
            onClick={() => this.handleOpenTestResult(result.id)}
        >
            <span className="test-name" >{`Test ${result.id}`}</span>
            <span className="test-status">{result.status.toString()}</span>
        </li>
    }

    private async handleOpenTestResult(taskID: number) {
        if (this.state.programDirectoryURI === undefined) {
            return;
        }

        this.messageService.info(`Opening 'Test ${taskID}' results...`);

        await this.autotestService.openResultsPage(this.state.programDirectoryURI, taskID);

        // const content = await this.autotestService.getResultsPage(this.state.programDirectoryURI, taskID) ?? ''; 
        // const newWindow = window.open('/autotester/render/render.php', 'view', 'toolbar=0,scrollbars=1,location=0,statusbar=0,menubar=0,resizable=0,width=700,height=700,left=312,top=234');

        // if(newWindow) {
        //     let html = content.replace('render.css', '/autotester/render/render.css');
        //     html = html.replace('render.js', '/autotester/render/render.js');
        //     html = html.replace('jsdiff/diff.js', '/autotester/render/jsdiff/diff.js');
        //     newWindow.document.write(html);
        // }

    }

    // TODO: Disable the 'Run Tests' button for current program
    //       while tests are running...
    private async handleRunTests() {
        if (!this.state.programDirectoryURI) {
            return;
        }

        if (this.autotestService.isBeingTested(this.state.programDirectoryURI)) {
            this.messageService.info("Allready running tests. Please wait...");
            return;
        }

        try {
            this.setState(state => {
                state.statusMessage = 'Initializing testing...';
                state.autotestResults = [];
                state.progressMessage = '';
            });

            const runInfo = await this.autotestService.runTests(this.state.programDirectoryURI, true);
            if (!runInfo.success) {
                let message = "";
                if (runInfo.status === AutotestRunStatus.ERROR_OPENING_DIRECTORY) {
                    message = "Could not open directory.";
                } else if (runInfo.status === AutotestRunStatus.NO_AUTOTESTS_DEFINED) {
                    message = "No autotests defined.";
                } else if (runInfo.status === AutotestRunStatus.RUNNING) {
                    message = "Allready running tests...";
                }
                this.setState(state => {
                    state.statusMessage = message;
                });
            }
        } catch (err) {
            this.setState(state => {
                state.statusMessage = err;
                state.progressMessage = '';
                state.autotestResults = [];
            });
        }

    }

}
