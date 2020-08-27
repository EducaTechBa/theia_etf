import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { FileSystem } from '@theia/filesystem/lib/common';
import { AutotestService, AutotestRunStatus, ProgramStatus } from './autotest-service';

// TODO: Replace status type number with TestResultStatus!!!
interface SimpleTestResult {
    id: string;
    success: boolean;
    status: number;
};

interface AutotestWidgetState {
    programDirectoryURI: string | undefined;
    autotestResults: SimpleTestResult[];
    statusMessage: string;
    progressMessage: string;
}

@injectable()
export class AutotestViewWidget extends ReactWidget {

    // TODO: Check all cases of setStatus...

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
            const { completedTests, program, inQueue, isBeingTested } = autotestEvent;
            const statusMessage = program.status.toString();
            const completionMessage = `Completed ${completedTests} out of ${program.totalTests} tests...`;
            const queueMessage = `${inQueue} programs awaiting execution...`;

            this.setState(state => {
                state.statusMessage = statusMessage;
                state.progressMessage = isBeingTested ? completionMessage : queueMessage;
            });
        });

        this.autotestService.onTestsFinished(autotestEvent => {
            const statusMessage = autotestEvent.program.status.toString();
            this.setState(state => {
                state.statusMessage = statusMessage;
            });

            if (autotestEvent.program.status === ProgramStatus.PROGRAM_FINISHED_TESTING) {
                this.autotestService.loadAutotestResultsFile(this.state.programDirectoryURI ?? '')
                    .then(content => {
                        const results = JSON.parse(content);
                        const simpleResults = this.getSimpleTestResultsFromAutotestResult(results);
                        this.setState(state => {
                            state.autotestResults = simpleResults;
                            state.progressMessage = '';
                        })
                    })
                    .catch(err => {
                        this.setState(state => {
                            state.progressMessage = "Could not load results...";
                        });
                    });
            }
        });

        this.editorManager.onCreated(editorWidget => this.handleEditorSwitch(editorWidget));
        this.editorManager.onActiveEditorChanged(editorWidget => this.handleEditorSwitch(editorWidget));
    }

    private setState(update: (state: AutotestWidgetState) => void) {
        update(this.state);
        this.update();
    }

    private async handleEditorSwitch(editorWidget: EditorWidget | undefined) {
        if (!editorWidget) {
            return;
        }
        const uri = editorWidget.getResourceUri()?.parent.toString();
        if (this.state.programDirectoryURI === uri) {
            return;
        }

        this.setState(state => {
            state.programDirectoryURI = uri;
        });

        const hasAutotests = await this.autotestService.hasAutotestsDefined(this.state.programDirectoryURI ?? '');
        if (!hasAutotests) {
            this.setState(state => {
                state.autotestResults = [];
                state.statusMessage = 'No autotests defined.';
            });
            return;
        }

        try {
            const content = await this.autotestService.loadAutotestResultsFile(this.state.programDirectoryURI ?? '')
            const results = JSON.parse(content);
            const simpleResults = this.getSimpleTestResultsFromAutotestResult(results);
            this.setState(state => {
                state.autotestResults = simpleResults;
                state.statusMessage = '';
            });
        } catch (err) {
            this.setState(state => {
                state.autotestResults = [];
                state.statusMessage = '';
            });
        }
    }

    private getSimpleTestResultsFromAutotestResult(results: any) {
        const testResults = Object.entries(results.test_results);
        return testResults.map(([id, testResult]) => {
            const { success, status } = testResult as SimpleTestResult;
            return {
                id, success, status,
            };
        });
    }

    protected render(): React.ReactNode {
        return <div id='widget-container'>
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

    // TODO: Improve list item and implement detailed results view...
    //       
    private renderTestResultItem(result: SimpleTestResult): React.ReactNode {
        return <li key={result.id}>
            <span>{`Test ${result.id}`}</span>
            <span>{result.success}</span> |
            <span>{result.status}</span>
        </li>
    }

    // TODO: Disable the 'Run Tests' button for current program
    //       while tests are running...
    private async handleRunTests() {
        if (!this.state.programDirectoryURI) {
            return;
        }

        try {
            this.setState(state => {
                state.autotestResults = [];
            });
            const runInfo = await this.autotestService.runTests(this.state.programDirectoryURI)
            if (!runInfo.success) {
                let message = "";
                if (runInfo.status === AutotestRunStatus.ERROR_OPENING_DIRECTORY) {
                    message = "Could not open directory.";
                } else if (runInfo.status === AutotestRunStatus.NO_AUTOTESTS_DEFINED) {
                    message = "No autotests defined.";
                }
                this.setState(state => {
                    state.progressMessage = message;
                });
            }
        } catch (err) {
            this.setState(state => {
                state.progressMessage = err;
            });
        }

        // PROGRAM COMPILE ERROR
        // if (programStatus === 3) {
        //     // Show error messages...
        //     this.currentAutotestResults = [];
        //     this.setCurrentProgramMessage("Program could not compile.");
        //     return;
        // }

        // // PROGRAM_FINISHED_TESTING
        // if (programStatus === 4) {
        //     await this.writeAutotestResultsFile(dirURI, JSON.stringify(result, null, 4));
        //     this.setSimpleTestResultsFromAutotestResult(result);
        //     this.setCurrentProgramMessage("Finished testing.");
        //     return;
        // }

        // // PROGRAM_NO_SORUCES_FOUND
        // if (programStatus === 6) {
        //     this.currentAutotestResults = [];
        //     this.setCurrentProgramMessage("No program sources found.");
        //     return;
        // }

        // // PROGRAM_CURRENTLY_TESTING
        // if (programStatus === 7) {
        //     // Display progress...
        //     this.currentAutotestResults = [];
        //     this.setCurrentProgramMessage("Testing...");
        //     return;
        // }

        // // PROGRAM_REJECTED
        // if (programStatus === 8) {
        //     // Display message that the program needs to be retested...
        //     this.currentAutotestResults = [];
        //     this.setCurrentProgramMessage("Could not test program. Please try again...");
        //     return;
        // }

    }

}
