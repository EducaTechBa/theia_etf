import { injectable, inject } from "inversify";
import { Emitter } from '@theia/core/lib/common/event';
import { Autotester } from './autotester';
import { FileSystem, FileStat } from '@theia/filesystem/lib/common';
import URI from '@theia/core/lib/common/uri';

interface AutotesterState {
    programs: Record<string, Program>
}

namespace AutotesterState {
    export function is(obj: object): obj is AutotesterState {
        return !!obj && "programs" in obj;
    }
}

interface Program {
    id: string;
    status: ProgramStatus;
    testResults: TestResult[];
}

enum ProgramStatus {
    PROGRAM_AWAITING_TESTS = 1,
    PROGRAM_PLAGIARIZED = 2,
    PROGRAM_COMPILE_ERROR = 3,
    PROGRAM_FINISHED_TESTING = 4,
    PROGRAM_GRADED = 5,
    PROGRAM_NO_SOURCES_FOUND = 6,
    PROGRAM_CURRENTLY_TESTING = 7,
    PROGRAM_REJECTED = 8,
}

interface TestResult {
    id: number;
    success: boolean;
    status: TestResultStatus;
}

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
    success: boolean,
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

@injectable()
export class AutotestService {

    // TODO: Add testing progress emitter???

    private readonly POLL_TIMEOUT_MS = 500;
    private readonly AUTOTEST_RESULTS_FILENAME = '.at_result';

    private state: AutotesterState = { programs: {} };

    private readonly onTestsStartedEmitter = new Emitter<AutotestEvent>();
    readonly onTestsStarted = this.onTestsStartedEmitter.event;

    private readonly onTestsFinishedEmitter = new Emitter<AutotestEvent>();
    readonly onTestsFinished = this.onTestsFinishedEmitter.event;

    constructor(
        @inject(Autotester) private readonly autotester: Autotester,
        @inject(FileSystem) private readonly fileSystem: FileSystem,
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
            program = await this.createProgram(taskID);
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

        this.onTestsStartedEmitter.fire({
            program,
            success: false
        });

        this.getResults(program.id);

        return {
            success: true,
            status: AutotestRunStatus.RUNNING
        };
    }

    private async createProgram(taskID: string): Promise<Program> {
        const id = await this.autotester.setProgram(taskID);
        return {
            id,
            status: ProgramStatus.PROGRAM_AWAITING_TESTS,
            testResults: []
        };
    }

    private getProgram(dirURI: string): Program {
        return this.state.programs[dirURI];
    }

    private async getResults(dirURI: string) {
        const program = this.getProgram(dirURI);
        const result = await this.autotester.getResults(program.id);
        program.status = this.integerToProgramStatus(result.status);

        // If the testing is not completed, getResults again...
        if (program.status === ProgramStatus.PROGRAM_AWAITING_TESTS) {
            await this.delay(this.POLL_TIMEOUT_MS);
            this.getResults(dirURI);
            return;
        }

        const success = program.status in [
            ProgramStatus.PROGRAM_COMPILE_ERROR,
            ProgramStatus.PROGRAM_NO_SOURCES_FOUND,
            ProgramStatus.PROGRAM_REJECTED
        ];

        if (success) {
            await this.writeAutotestResultsFile(dirURI, JSON.stringify(result, null, 4));
        }

        // TODO: Populate program.taskResults

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
            const autotestURI = `${dirURI}/.autotest2`;
            const autotestFile = await this.fileSystem.resolveContent(autotestURI);
            const autotestContent = autotestFile.content;
            return autotestContent;
        } catch (_) {
            return undefined;
        }
    }

    private async writeAutotestResultsFile(dirURI: string, content: string): Promise<FileStat> {
        const uri = `${dirURI}/${this.AUTOTEST_RESULTS_FILENAME}`;
        return await this.fileSystem.createFile(uri, { content });
    }

    public async hasAutotestsDefined(dirURI: string): Promise<boolean> {
        const uri = `${dirURI}/${this.AUTOTEST_RESULTS_FILENAME}`;
        const fileStat = await this.fileSystem.getFileStat(uri);
        return fileStat !== undefined;
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
