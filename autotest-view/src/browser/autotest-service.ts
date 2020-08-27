import { injectable, inject } from "inversify";
import { Emitter } from '@theia/core/lib/common/event';
import { Autotester } from './autotester';
import { FileSystem, FileStat } from '@theia/filesystem/lib/common';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import URI from '@theia/core/lib/common/uri';

interface AutotesterState {
    programs: Record<string, Program>
}

namespace AutotesterState {
    export function is(obj: object): obj is AutotesterState {
        return !!obj && "programs" in obj;
    }
}

export interface Program {
    id: string;
    status: ProgramStatus;
    totalTests: number;
    testResults: TestResult[];
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

export interface TestResult {
    id: number;
    success: boolean;
    status: TestResultStatus;
}

// TODO: Map to messages of status...
export enum TestResultStatus {
    TEST_SUCCESS = 1,
    TEST_SYMBOL_NOT_FOUND = 2,
    TEST_COMPILE_FAILED = 3,
    TEST_EXECUTION_TIMEOUT = 4,
    TEST_EXECUTION_CRASH = 5,
    TEST_WRONG_OUTPUT = 6,
    TEST_PROFILER_ERROR = 7,
    TEST_OUTPUT_NOT_FOUND = 8,
    TEST_UNEXPECTED_EXCEPTION = 9,
    TEST_INTERNAL_ERROR = 10,
    TEST_UNZIP_FAILED = 11,
    TEST_TOOL_FAILED = 12,
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

export interface AutotestEvent {
    program: Program,
}

export interface AutotestUpdateEvent extends AutotestEvent {
    inQueue: number,
    completedTests: number,
    isBeingTested: boolean,
}

export interface AutotestFinishEvent extends AutotestEvent {
    success: boolean
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

// TODO: Maybe do the same as above for the TestResultStatus

@injectable()
export class AutotestService {

    private readonly POLL_TIMEOUT_MS = 500;
    private readonly AUTOTEST_RESULTS_FILENAME = '.at_result';
    private readonly AUTOTEST_FILENAME = '.autotest2';

    private state: AutotesterState = { programs: {} };

    private readonly onTestsFinishedEmitter = new Emitter<AutotestFinishEvent>();
    readonly onTestsFinished = this.onTestsFinishedEmitter.event;

    private readonly onTestsUpdateEmitter = new Emitter<AutotestUpdateEvent>();
    readonly onTestsUpdate = this.onTestsUpdateEmitter.event;

    constructor(
        @inject(Autotester) private readonly autotester: Autotester,
        @inject(FileSystem) private readonly fileSystem: FileSystem,
        @inject(WorkspaceService) private readonly workspaceService: WorkspaceService,
    ) { }

    public async runTests(dirURI: string): Promise<AutotestRunInfo> {
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
            program = await this.createProgram(taskID, autotest.tests.length);
            this.state.programs[dirURI] = program;
        }

        console.log(`Program ID: ${program.id}`);

        const dir = await this.fileSystem.getFileStat(dirURI);
        if (!dir || !dir.isDirectory) {
            return {
                success: false,
                status: AutotestRunStatus.ERROR_OPENING_DIRECTORY
            };
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

        // TODO: Fix setting progrma files. AGAIN IDIOT!!!!!!!!!!!!!!

        const files = await Promise.all(promises);
        await this.autotester.setProgramFiles(program.id, files);
        console.log("Source files are set...");

        this.getResults(dirURI);

        return {
            success: true,
            status: AutotestRunStatus.RUNNING
        };
    }

    private async createProgram(taskID: string, totalTests: number): Promise<Program> {
        const id = await this.autotester.setProgram(taskID);
        return {
            id,
            status: ProgramStatus.PROGRAM_AWAITING_TESTS,
            testResults: [],
            totalTests,
        };
    }

    private getProgram(dirURI: string): Program | undefined {
        return this.state.programs[dirURI];
    }

    private async getResults(dirURI: string) {
        const program = this.getProgram(dirURI);

        if (!program) {
            console.log('No program found...');
            return;
        }

        const result = await this.autotester.getResults(program.id);
        program.status = this.integerToProgramStatus(result.status);
        const inQueue = result.queue_items ?? 0;
        const completedTests = Object.entries(result.test_results).length;

        // If the testing is not completed, getResults again...
        if (program.status === ProgramStatus.PROGRAM_AWAITING_TESTS
            || program.status === ProgramStatus.PROGRAM_CURRENTLY_TESTING) {
            this.onTestsUpdateEmitter.fire({
                program,
                inQueue,
                isBeingTested: program.status === ProgramStatus.PROGRAM_CURRENTLY_TESTING,
                completedTests,
            });
            await this.delay(this.POLL_TIMEOUT_MS);
            this.getResults(dirURI);
            return;
        }

        const success = !(program.status in [
            ProgramStatus.PROGRAM_COMPILE_ERROR,
            ProgramStatus.PROGRAM_NO_SOURCES_FOUND,
            ProgramStatus.PROGRAM_REJECTED
        ]);

        if (success) {
            await this.writeAutotestResultsFile(dirURI, JSON.stringify(result, null, 4));
        }

        // TODO: Populate program.taskResults

        console.log(JSON.stringify(program));

        this.onTestsFinishedEmitter.fire({ program, success });
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
            const autotestFile = await this.fileSystem.resolveContent(autotestURI);
            const autotestContent = autotestFile.content;
            return autotestContent;
        } catch (_) {
            return undefined;
        }
    }

    private async writeAutotestResultsFile(dirURI: string, content: string): Promise<FileStat> {
        const uri = `${dirURI}/${this.AUTOTEST_RESULTS_FILENAME}`;
        try {
            await this.fileSystem.delete(uri);
        } catch(_) {}
        return await this.fileSystem.createFile(uri, { content });
    }

    public async hasAutotestsDefined(dirURI: string): Promise<boolean> {
        const uri = `${dirURI}/${this.AUTOTEST_FILENAME}`;
        const workspaceUri = this.workspaceService.workspace?.uri;
        const trimmed = uri.slice(workspaceUri?.length);
        return await this.workspaceService.containsSome([trimmed]);
    }

    public async loadAutotestResultsFile(dirURI: string): Promise<string> {
        try {
            const uri = `${dirURI}/${this.AUTOTEST_RESULTS_FILENAME}`;
            const file = await this.fileSystem.resolveContent(uri);
            return file.content;
        } catch (_) {
            throw "No autotest results.";
        }
    }

}
