import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { FileSystem } from '@theia/filesystem/lib/common';
import { AutotestService, AutotestRunStatus } from './autotest-service';

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
    private currentAutotestResults: SimpleTestResult[] = [];
    private currentProgramMessage: string = "";

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

        this.autotestService.onTestsStarted(autotestEvent => {
            this.setCurrentProgramMessage("Running tests...");
        });

        this.autotestService.onTestsFinished(autotestEvent => {
            this.setCurrentProgramMessage("Test finished...");
        });

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

        const hasAutotests = await this.autotestService.hasAutotestsDefined(this.currentProgramDirectoryURI ?? '');
        if (!hasAutotests) {
            this.currentAutotestResults = [];
            this.setCurrentProgramMessage("No autotests defined.");
            return;
        }

        try {
            const content = await this.autotestService.loadAutotestResultsFile(this.currentProgramDirectoryURI ?? '')
            const results = JSON.parse(content);
            this.setSimpleTestResultsFromAutotestResult(results);
            this.clearCurrentProgramMessage();
        } catch (err) {
            this.currentAutotestResults = [];
            this.setCurrentProgramMessage(err);
        }
    }

    private setSimpleTestResultsFromAutotestResult(results: any) {
        const testResults = Object.entries(results.test_results);
        this.currentAutotestResults = testResults.map(([id, testResult]) => {
            const { success, status } = testResult as SimpleTestResult;
            return {
                id, success, status,
            };
        });
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
        // TODO: When tests are running, show how many are completed...
        //       When the tests are finished, write the .at_results file nad this.update()
        //       If the program is waiting in queue, display how many are in front...
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
    private async handleRunTests() {
        if (!this.currentProgramDirectoryURI) {
            return;
        }

        try {
            const runInfo = await this.autotestService.runTests(this.currentProgramDirectoryURI)
            if (!runInfo.success) {
                let message = "";
                if(runInfo.status === AutotestRunStatus.ERROR_OPENING_DIRECTORY) {
                    message = "Could not open directory.";
                } else if (runInfo.status === AutotestRunStatus.NO_AUTOTESTS_DEFINED) {
                    message = "No autotests defined.";
                }
                this.setCurrentProgramMessage(message);
            }
        } catch (err) {
            this.setCurrentProgramMessage(err);
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
