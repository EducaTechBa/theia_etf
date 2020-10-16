import { injectable, inject } from "inversify";
import { Emitter } from '@theia/core/lib/common/event';
import { Autotester } from './autotester';
import { FileStatWithMetadata } from '@theia/filesystem/lib/common/files';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import URI from '@theia/core/lib/common/uri';
// @ts-ignore
import { SessionManager } from 'top-bar/lib/browser/session-manager';

interface AutotesterState {
    programs: Record<string, Program | undefined>
}

namespace AutotesterState {
    export function is(obj: object): obj is AutotesterState {
        return !!obj && "programs" in obj;
    }
}

export interface Program {
    id: string;
    uri: string;
    status: ProgramStatus;
    totalTests: number;
    isUserInvoked: boolean,
    result?: Result;
}

// TODO: Move Program[status | totalTests] to Result
//       Move Result[isWaiting | isBeingTested | inQueue | completedTests] to TestingProgress
export interface Result {
    completedTests: number;
    isBeingTested: boolean;
    isWaiting: boolean;
    inQueue: number;
    testResults: TestResult[];
}

export interface TestResult {
    id: number;
    success: boolean;
    status: TestResultStatus;
}

export enum ProgramStatus {
    PROGRAM_AWAITING_TESTS = "Waiting in queue...",
    PROGRAM_PLAGIARIZED = "Program is plagiarized!",
    PROGRAM_COMPILE_ERROR = "Program could not be compiled!",
    PROGRAM_FINISHED_TESTING = "Done testing!",
    PROGRAM_GRADED = "Program graded!",
    PROGRAM_NO_SOURCES_FOUND = "No sources to be tested found...",
    PROGRAM_CURRENTLY_TESTING = "Running tests...",
    PROGRAM_REJECTED = "Could not test program. Please try again...",
}

export enum TestResultStatus {
    TEST_SUCCESS = "Success!",
    TEST_SYMBOL_NOT_FOUND = "Symbol not found",
    TEST_COMPILE_FAILED = "Could not compile program",
    TEST_EXECUTION_TIMEOUT = "Program took too long to execute",
    TEST_EXECUTION_CRASH = "Program crashed",
    TEST_WRONG_OUTPUT = "Wrong output",
    TEST_PROFILER_ERROR = "Profiler error",
    TEST_OUTPUT_NOT_FOUND = "Output not found",
    TEST_UNEXPECTED_EXCEPTION = "Unexpected exception",
    TEST_INTERNAL_ERROR = "Internal server error",
    TEST_UNZIP_FAILED = "Unzip failed",
    TEST_TOOL_FAILED = "Execution tool failed",
}

export interface AutotestRunInfo {
    success: boolean;
    status: AutotestRunStatus
}

export enum AutotestRunStatus {
    RUNNING = 1,
    NO_AUTOTESTS_DEFINED = 2,
    ERROR_OPENING_DIRECTORY = 3,
}

export enum AutotestCancelStatus {
    CANCELED = 1,
    NOT_USER_INVOKED = 2,
    NO_PROGRAM = 3,
}

export interface AutotestEvent {
    program: Program,
}

// TODO: Find a way to avoid this -_-
const integerToProgramStatusMapping: Record<number, ProgramStatus> = {
    1: ProgramStatus.PROGRAM_AWAITING_TESTS,
    2: ProgramStatus.PROGRAM_PLAGIARIZED,
    3: ProgramStatus.PROGRAM_COMPILE_ERROR,
    4: ProgramStatus.PROGRAM_FINISHED_TESTING,
    5: ProgramStatus.PROGRAM_GRADED,
    6: ProgramStatus.PROGRAM_NO_SOURCES_FOUND,
    7: ProgramStatus.PROGRAM_CURRENTLY_TESTING,
    8: ProgramStatus.PROGRAM_REJECTED,
}

// TODO: Find a way to avoid this -_-
const integerToTestResultStatusMapping: Record<number, TestResultStatus> = {
    1: TestResultStatus.TEST_SUCCESS,
    2: TestResultStatus.TEST_SYMBOL_NOT_FOUND,
    3: TestResultStatus.TEST_COMPILE_FAILED,
    4: TestResultStatus.TEST_EXECUTION_TIMEOUT,
    5: TestResultStatus.TEST_EXECUTION_CRASH,
    6: TestResultStatus.TEST_WRONG_OUTPUT,
    7: TestResultStatus.TEST_PROFILER_ERROR,
    8: TestResultStatus.TEST_OUTPUT_NOT_FOUND,
    9: TestResultStatus.TEST_UNEXPECTED_EXCEPTION,
    10: TestResultStatus.TEST_INTERNAL_ERROR,
    11: TestResultStatus.TEST_UNZIP_FAILED,
    12: TestResultStatus.TEST_TOOL_FAILED,
}

@injectable()
export class AutotestService {

    private readonly POLL_TIMEOUT_MS = 500;
    private readonly AUTOTEST_RESULTS_FILENAME = '.at_result';
    private readonly AUTOTEST_FILENAME = '.autotest2';

    private state: AutotesterState = { programs: {} };

    private readonly onTestsFinishedEmitter = new Emitter<AutotestEvent>();
    readonly onTestsFinished = this.onTestsFinishedEmitter.event;

    private readonly onTestsUpdateEmitter = new Emitter<AutotestEvent>();
    readonly onTestsUpdate = this.onTestsUpdateEmitter.event;

    private readonly onTestsCanceledEmitter = new Emitter<AutotestEvent>();
    readonly onTestsCanceled = this.onTestsCanceledEmitter.event;

    constructor(
        @inject(Autotester) private readonly autotester: Autotester,
        @inject(FileService) private readonly fileService: FileService,
        @inject(WorkspaceService) private readonly workspaceService: WorkspaceService,
        @inject(SessionManager) private readonly sessionManager: SessionManager,
    ) { }

    public async runTests(dirURI: string, isUserInvoked: boolean): Promise<AutotestRunInfo> {
        if (this.isBeingTested(dirURI)) {
            return {
                success: false,
                status: AutotestRunStatus.RUNNING
            };
        }

        const autotestContent = await this.loadAutotestFile(dirURI);
        if (!autotestContent) {
            return {
                success: false,
                status: AutotestRunStatus.NO_AUTOTESTS_DEFINED
            };
        }

        const autotest = JSON.parse(autotestContent);
        const taskID = await this.autotester.setTask(autotest);
        console.log(`Task ID: ${taskID}`);

        let program = this.getProgram(dirURI);
        if (!program) {
            const taskName = await this.resolveTaskName(dirURI);
            program = await this.createProgram(taskID, taskName, autotest.tests.length, dirURI, isUserInvoked);
            this.state.programs[dirURI] = program;
        }
        program.isUserInvoked = isUserInvoked;

        console.log(`Program ID: ${program.id}`);

        const dir = await this.fileService.resolve(new URI(dirURI));

        if (!dir || !dir.isDirectory) {
            return {
                success: false,
                status: AutotestRunStatus.ERROR_OPENING_DIRECTORY
            };
        }

        const filesStats = dir.children ?? [];
        const assignmentFiles = filesStats.map(file => ({
            uri: file.resource,
            name: new URI(file.resource.toString()).displayName
        }));


        const promises = assignmentFiles.map(file =>
            this.fileService
                .read(file.uri)
                .then(({ value }) => ({
                    ...file,
                    uri: file.uri.toString(),
                    content: value
                }))
        );

        const files = await Promise.all(promises);
        await this.autotester.setProgramFiles(program.id, files);
        console.log("Source files are set...");

        this.getResults(dirURI);

        return {
            success: true,
            status: AutotestRunStatus.RUNNING
        };
    }

    private async resolveTaskName(dirURI: string): Promise<string> {
        const userInfo = await this.sessionManager.getUserInfo();
        const path = this.getPathInWorkspace(dirURI);
        return `${userInfo.username}/${path}`;
    }

    private async createProgram(taskID: string, taskName: string, totalTests: number, uri: string, isUserInvoked: boolean): Promise<Program> {
        const id = await this.autotester.setProgram(taskID, taskName);
        return {
            id,
            status: ProgramStatus.PROGRAM_AWAITING_TESTS,
            totalTests,
            uri,
            isUserInvoked,
        };
    }

    public getProgram(dirURI: string): Program | undefined {
        return this.state.programs[dirURI];
    }

    private clearProgramResults(dirURI: string) {
        const program = this.state.programs[dirURI];
        if (program !== undefined) {
            program.result = undefined;
        }
    }

    private async getResults(dirURI: string) {
        console.log("Getting resutls...");

        const program = this.getProgram(dirURI);

        if (!program) {
            console.log('No program found...');
            return;
        }

        const responseResult = await this.autotester.getResults(program.id);
        program.status = this.integerToProgramStatus(responseResult.status);

        const testResultsObjects = responseResult.test_results ?? [];

        const result: Result = {
            inQueue: responseResult.queue_items ?? 0,
            isWaiting: program.status === ProgramStatus.PROGRAM_AWAITING_TESTS,
            isBeingTested: program.status === ProgramStatus.PROGRAM_CURRENTLY_TESTING,
            completedTests: Object.entries(testResultsObjects).length,
            testResults: [],
        };

        program.result = result;

        // If the testing is not completed, getResults again...
        if (program.status === ProgramStatus.PROGRAM_AWAITING_TESTS
            || program.status === ProgramStatus.PROGRAM_CURRENTLY_TESTING) {
            this.onTestsUpdateEmitter.fire({ program });
            await this.delay(this.POLL_TIMEOUT_MS).then(() => this.getResults(dirURI));
            return;
        }

        // TODO: Populate program.taskResults

        await this.writeAutotestResultsFile(dirURI, JSON.stringify(responseResult, null, 4));
        this.clearProgramResults(dirURI);

        this.onTestsFinishedEmitter.fire({ program });
    }

    public async cancelTests(dirURI: string, preventNonUserInvokedCancel: boolean = true): Promise<AutotestCancelStatus> {
        const program = this.getProgram(dirURI);

        if (program === undefined) {
            return AutotestCancelStatus.NO_PROGRAM;
        }

        // TODO: Check if this condition is correct...
        if (preventNonUserInvokedCancel && !program.isUserInvoked) {
            return AutotestCancelStatus.NOT_USER_INVOKED;
        }

        this.removeProgram(dirURI);
        this.onTestsCanceledEmitter.fire({ program });

        return AutotestCancelStatus.CANCELED;
    }

    private removeProgram(dirURI: string) {
        this.state.programs[dirURI] = undefined;
    }

    private integerToProgramStatus(status: number): ProgramStatus {
        return integerToProgramStatusMapping[status];
    }

    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async loadAutotestFile(dirURI: string): Promise<string | undefined> {
        try {
            const autotestURI = `${dirURI}/${this.AUTOTEST_FILENAME}`;
            const autotestFile = await this.fileService.read(new URI(autotestURI));
            const autotestContent = autotestFile.value;
            return autotestContent;
        } catch (_) {
            return undefined;
        }
    }

    private async writeAutotestResultsFile(dirURI: string, content: string): Promise<FileStatWithMetadata> {
        const uri = `${dirURI}/${this.AUTOTEST_RESULTS_FILENAME}`;
        try {
            await this.fileService.delete(new URI(uri));
        } catch (_) { }
        return await this.fileService.create(new URI(uri), content);
    }

    public async hasAutotestsDefined(dirURI: string): Promise<boolean> {
        const uri = `${dirURI}/${this.AUTOTEST_FILENAME}`;
        const trimmed = await this.getPathInWorkspace(uri);
        return await this.workspaceService.containsSome([trimmed]);
    }

    private getPathInWorkspace(uri: string): string {
        const workspaceUri = this.workspaceService.workspace?.resource.toString();
        return uri.slice(workspaceUri?.length);
    }

    private async loadAutotestResultsFile(dirURI: string): Promise<string | undefined> {
        try {
            const uri = `${dirURI}/${this.AUTOTEST_RESULTS_FILENAME}`;
            const file = await this.fileService.read(new URI(uri));
            return file.value;
        } catch (_) {
            return undefined;
        }
    }

    public async getProgramFromAutotestResultFile(dirURI: string): Promise<Program | undefined> {
        const content = await this.loadAutotestResultsFile(dirURI);
        if (content === undefined) {
            return undefined;
        }

        const data = JSON.parse(content)
        let testResults: TestResult[] = [];
        if (data.test_results) {
            const testResultObjects = Object.entries(data.test_results);
            testResults = testResultObjects.map(([key, value]) => {
                const result = value as any;
                const id = Number(key);
                const success = result.success as boolean;
                const status = this.integerToTestResultStatus(result.status);
                return { id, success, status };
            });
        }

        const result: Result = {
            isBeingTested: false,
            isWaiting: false,
            inQueue: 0,
            completedTests: 0,
            testResults
        };

        const program: Program = {
            id: '',
            totalTests: 0,
            uri: dirURI,
            status: this.integerToProgramStatus(data.status),
            result,
            isUserInvoked: false,
        };

        return program;
    }

    public async getTestPassResults(dirURI: string): Promise<{ passed: number, total: number }> {
        const program = await this.getProgramFromAutotestResultFile(dirURI);

        if (program === undefined) {
            return {
                passed: -1,
                total: -1,
            };
        }

        const testResults = program.result?.testResults ?? [];
        const total = testResults.length;
        const passed = testResults.filter(testResult => testResult.success).length;

        return { total, passed };
    }

    private integerToTestResultStatus(status: number): TestResultStatus {
        return integerToTestResultStatusMapping[status];
    }

    public isBeingTested(dirURI: string): boolean {
        const program = this.state.programs[dirURI];
        return program !== undefined && program.result !== undefined;
    }

    public async getResultsPage(dirURI: string, taskID: number): Promise<string | undefined> {
        const autotestContent = await this.loadAutotestFile(dirURI);
        const resultsContent = await this.loadAutotestResultsFile(dirURI);

        if (autotestContent === undefined || resultsContent === undefined) {
            return undefined;
        }

        const autotest = encodeURIComponent(autotestContent);
        const results = encodeURIComponent(resultsContent);

        const url = `/autotester/render/render.php?language=bs`
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `task=${autotest}&result=${results}&test=${taskID}`
        });
        return res.text();
    }

    public async openResultsPage(dirURI: string, testID: number) {
        const autotestContent = await this.loadAutotestFile(dirURI);
        const resultsContent = await this.loadAutotestResultsFile(dirURI);

        if (autotestContent === undefined || resultsContent === undefined) {
            return undefined;
        }

        const form = document.createElement("form");
        form.setAttribute("id", "renderer_form");
        form.setAttribute("method", "post");
        form.setAttribute("action", "/autotester/render/render.php");
        form.setAttribute("target", "view");

        const hiddenField = document.createElement("input");
        hiddenField.setAttribute("type", "hidden");
        hiddenField.setAttribute("name", "task");
        hiddenField.setAttribute("value", autotestContent);
        form.appendChild(hiddenField);
        const hiddenField1 = document.createElement("input");
        hiddenField1.setAttribute("type", "hidden");
        hiddenField1.setAttribute("name", "result");
        hiddenField1.setAttribute("value", resultsContent);
        form.appendChild(hiddenField1);
        const hiddenField2 = document.createElement("input");
        hiddenField2.setAttribute("type", "hidden");
        hiddenField2.setAttribute("name", "test");
        hiddenField2.setAttribute("value", testID.toString());
        form.appendChild(hiddenField2);
        document.body.appendChild(form);

        window.open('', 'view', 'toolbar=0,scrollbars=1,location=0,statusbar=0,menubar=0,resizable=0,width=700,height=700,left=312,top=234');
        form.submit();
        document.body.removeChild(form);
    }

}
