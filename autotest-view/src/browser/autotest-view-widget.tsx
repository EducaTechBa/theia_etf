import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { FileSystem } from '@theia/filesystem/lib/common';
import { AutotestService, AutotestRunStatus, Program, TestResult, AutotestCancelStatus } from './autotest-service';

interface AutotestWidgetState {
    programDirectoryURI: string | undefined;
    autotestResults: TestResult[];
    statusMessage: string;
    progressMessage: string;
    isRunningTests: boolean;
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
        isRunningTests: false
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

        const initialActiveEditor = this.getInitialActiveEditor();
        if(initialActiveEditor) {
            this.handleEditorSwitch(initialActiveEditor)
        }
    }

    private getInitialActiveEditor(): EditorWidget | undefined {
        return this.editorManager.currentEditor;
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
            state.isRunningTests = true;
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
            state.isRunningTests = false;
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
                state.isRunningTests = false;
            });
            return;
        }

        await this.setStateFinished(this.state.programDirectoryURI);
    }

    protected render(): React.ReactNode {
        return <div id='autotests-container'>
            <button
                className="theia-button run-tests-button"
                onClick={() => this.handleButtonClick()}
            >
                {this.state.isRunningTests ? "Cancel tests" : "Run tests"}
            </button>
            <span>{this.state.statusMessage}</span>
            <span>{this.state.progressMessage}</span>
            <ul className="test-list">
                {this.state.autotestResults.map(result => this.renderTestResultItem(result))}
            </ul>
        </div>
    }

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

    private async handleButtonClick() {
        if(this.state.isRunningTests) {
            console.log("Canceling tests...");
            await this.handleCancelTests();
        } else {
            console.log("Running tests...");
            await this.handleRunTests();
        }
    }

    private async handleOpenTestResult(taskID: number) {
        if (this.state.programDirectoryURI === undefined) {
            return;
        }

        this.messageService.info(`Opening 'Test ${taskID}' results...`);
        await this.autotestService.openResultsPage(this.state.programDirectoryURI, taskID);
    }

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
                state.isRunningTests = true;
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
                    state.isRunningTests = false;
                });
            }
        } catch (err) {
            this.setState(state => {
                state.isRunningTests = false;
                state.statusMessage = err;
                state.progressMessage = '';
                state.autotestResults = [];
            });
        }

    }

    private async handleCancelTests() {
        if(this.state.programDirectoryURI === undefined) {
            return;
        }

        const runningStatus = await this.autotestService.cancelTests(this.state.programDirectoryURI);
        if(runningStatus === AutotestCancelStatus.NOT_USER_INVOKED) {
            this.messageService.info("Could not cancel tests not invoked by user");
            return;
        } else if(runningStatus === AutotestCancelStatus.NO_PROGRAM) {
            return;
        }

        await this.setStateFinished(this.state.programDirectoryURI);
    }

}
