import { injectable, inject, postConstruct } from 'inversify';
import { TaskService } from '@theia/task/lib/browser';
import {
    TaskConfiguration,
    TaskScope,
    RevealKind,
    PanelKind,
    TaskInfo
} from '@theia/task/lib/common/task-protocol'
import { TaskWatcher } from '@theia/task/lib/common/task-watcher';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import URI from '@theia/core/lib/common/uri';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { MessageService } from '@theia/core';
import { FileChangeType } from '@theia/filesystem/lib/common/files';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';

interface TaskCommands {
    build?: string;
    run: string;
}

interface DirectoryTasks {
    task?: TaskCommands,
    children?: {
        [name: string]: DirectoryTasks
    }
}

@injectable()
export class TaskRunner {

    private readonly RELATIVE_TASK_CONFIG_JSON_PATH = '/.theia/directory_task_config.json';

    private directoryTasks: DirectoryTasks = {};
    private currentRunningTask: TaskInfo | undefined;
    private currentFileURI: URI | undefined;
    private onTaskStateChangeCallback: ((isRunning: boolean) => void) | undefined;
    private asanWatcherDisposables: DisposableCollection = new DisposableCollection();
    private currentTaskTerminalId: number | undefined;

    @inject(TaskService)
    protected readonly taskService: TaskService;

    @inject(TaskWatcher)
    protected readonly taskWatcher: TaskWatcher;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(FileService)
    protected readonly fileService: FileService;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(TerminalService)
    protected readonly terminalService: TerminalService;

    @postConstruct()
    // @ts-ignore
    private async init() {
        await this.ensureDirectoryTasksLoaded();

        // Subscribe to task events
        // Note: We also call handleTaskStarted directly in runTask() for immediate response
        // This event handler catches tasks that might be started elsewhere
        this.taskWatcher.onTaskCreated(taskInfo => {
            console.log("onTaskCreated event fired:", taskInfo);
            // Only handle if we don't already have this task tracked
            if (!this.currentRunningTask || this.currentRunningTask.taskId !== taskInfo.taskId) {
                this.handleTaskStarted(taskInfo);
            }
        });

        this.taskWatcher.onDidEndTaskProcess(taskEvent => {
            console.log("onDidEndTaskProcess event fired:", taskEvent);
            this.handleTaskEnded(taskEvent.taskId);
        });
    }

    /**
     * Ensures that directory tasks are loaded. This method can be called multiple times safely.
     * It will only load the configuration if it hasn't been loaded yet or if it's empty.
     */
    private async ensureDirectoryTasksLoaded(): Promise<void> {
        // If we already have tasks loaded (non-empty object), no need to reload
        if (this.directoryTasks && Object.keys(this.directoryTasks).length > 0) {
            console.log('Directory tasks already loaded, skipping reload');
            return;
        }

        const workspaceRoot = this.workspaceService.workspace?.resource;
        if (!workspaceRoot) {
            console.error('TaskRunner: workspace not available yet, cannot load task configuration');
            return;
        }

        const path = `${workspaceRoot.toString()}${this.RELATIVE_TASK_CONFIG_JSON_PATH}`;
        const jsonURI = new URI(path);

        console.log(`TaskRunner: Loading task configuration from: ${path}`);
        this.directoryTasks = await this.loadDirectoryTaskConfigFromJson(jsonURI);

        if (Object.keys(this.directoryTasks).length === 0) {
            console.warn('TaskRunner: Loaded task configuration is empty');
        } else {
            console.log('TaskRunner: Successfully loaded task configuration:', this.directoryTasks);
        }
    }

    private async loadDirectoryTaskConfigFromJson(fileURI: URI): Promise<DirectoryTasks> {
        try {
            const fileContent = await this.fileService.read(fileURI);
            const directoryTasks = JSON.parse(fileContent.value) as DirectoryTasks;
            console.log(`TaskRunner: Parsed task configuration from ${fileURI.toString()}`);
            return directoryTasks;
        } catch (err) {
            console.error(`TaskRunner: Could not load task configuration from ${fileURI.toString()}: ${err}`);
            return {};
        }
    }

    /**
     * Substitutes common task variables with their actual values.
     * Supports: ${file}, ${fileDirname}, ${fileBasename}, ${fileBasenameNoExtension}
     */
    private substituteVariables(command: string, file: string, fileDirname: string, fileBasename: string, fileBasenameNoExtension: string): string {
        return command
            .replace(/\$\{file\}/g, file)
            .replace(/\$\{fileDirname\}/g, fileDirname)
            .replace(/\$\{fileBasename\}/g, fileBasename)
            .replace(/\$\{fileBasenameNoExtension\}/g, fileBasenameNoExtension);
    }

    private createTaskConfigration(label: string, command: string, isBackground?: boolean, dependsOn?: string, cwd?: string): TaskConfiguration {
        return {
            label,
            _scope: TaskScope.Workspace,
            type: 'shell',
            command,
            options: {
                cwd: cwd || "${fileDirname}"
            },
            presentation: {
                clear: true,
                showReuseMessage: false,
                echo: false,
                reveal: RevealKind.Always,
                panel: PanelKind.Dedicated,
                focus: true
            },
            dependsOn,
            isBackground
        };
    }

    private getInWorkspacePath(uri: string): string {
        const workspaceUri = this.workspaceService.workspace?.resource.toString();
        return uri.slice(workspaceUri?.length);
    }

    private getTaskCommandsByPath(path: string): TaskCommands {
        const pathParts = path.split('/').slice(1, -1);

        let currentDirectoryTasks = this.directoryTasks;
        let currentTask = this.directoryTasks.task;

        for (const part of pathParts) {
            const children = currentDirectoryTasks.children;
            if (children && children[part]) {
                currentDirectoryTasks = children[part];
                if (children[part].task) {
                    currentTask = children[part].task;
                }
            } else {
                break
            }
        }

        return currentTask ?? {
            run: 'sleep 1s && echo "No run task defined..."'
        };
    }

    public async runTask(fileURI: URI) {
        // Ensure task configuration is loaded (lazy loading in case init() failed)
        await this.ensureDirectoryTasksLoaded();

        // Store the current file URI for ASAN watcher
        this.currentFileURI = fileURI;

        const inWorkspacePath = this.getInWorkspacePath(fileURI + '');

        const { build, run } = this.getTaskCommandsByPath(inWorkspacePath);

        // Prepare variable substitutions
        const file = fileURI.path.toString();
        const fileDirname = fileURI.parent.path.toString();
        const fileBasename = fileURI.path.base;
        const fileBasenameNoExtension = fileURI.path.name;

        // Substitute variables in commands
        const substitutedBuild = build ? this.substituteVariables(build, file, fileDirname, fileBasename, fileBasenameNoExtension) : undefined;
        const substitutedRun = this.substituteVariables(run, file, fileDirname, fileBasename, fileBasenameNoExtension);

        const buildTaskLabel = `Build ${inWorkspacePath}`;
        const runTaskLabel = `Run ${inWorkspacePath}`;

        if (substitutedBuild) {
            const buildTask = this.createTaskConfigration(buildTaskLabel, substitutedBuild, true, fileDirname);
            await this.taskService.runTask(buildTask);
        }

        const dependsOn = substitutedBuild ? buildTaskLabel : undefined;

        const runTask = this.createTaskConfigration(runTaskLabel, substitutedRun, false, dependsOn, fileDirname);
        const taskInfo = await this.taskService.runTask(runTask);

        // Call handleTaskStarted directly since events might have already fired
        // But only if we got a valid taskInfo with a valid taskId
        if (taskInfo && taskInfo.taskId > 0) {
            console.log("runTask returned valid taskInfo:", taskInfo);
            this.handleTaskStarted(taskInfo);

            // Check after a short delay if the task is still running
            // This handles the case where task exits immediately (e.g., script doesn't exist)
            setTimeout(async () => {
                await this.verifyTaskStillRunning(taskInfo.taskId);
            }, 500);
        } else {
            console.log("runTask returned invalid taskInfo or task failed to start:", taskInfo);
            // Task failed to start properly, ensure we're in stopped state
            this.resetTaskState();
        }
    }

    public async stopTask() {
        if (this.currentRunningTask) {
            try {
                await this.taskService.terminateTask(this.currentRunningTask);
                // Clean up ASAN watcher when manually stopping
                this.disposeAsanWatcher();
            } catch (err) {
                console.error('Error stopping task:', err);
                // Task might have already ended, reset state to recover
                this.resetTaskState();
            }
        } else {
            // If we're in a stuck state where button thinks task is running
            // but currentRunningTask is undefined, force a reset
            console.log('stopTask called but no currentRunningTask, forcing reset');
            this.resetTaskState();
        }
    }

    public isTaskRunning(): boolean {
        return this.currentRunningTask !== undefined;
    }

    public setOnTaskStateChangeCallback(callback: (isRunning: boolean) => void) {
        this.onTaskStateChangeCallback = callback;
    }

    private handleTaskStarted(taskInfo: TaskInfo) {
        // Only track tasks that we started (not background tasks from dependencies)
        if (taskInfo && taskInfo.taskId > 0 && !taskInfo.config.isBackground) {
            console.log(`handleTaskStarted: taskId=${taskInfo.taskId}, label=${taskInfo.config.label}, terminalId=${taskInfo.terminalId}`);
            this.currentRunningTask = taskInfo;

            // Track the terminal ID so we can close it later
            if (taskInfo.terminalId) {
                this.currentTaskTerminalId = taskInfo.terminalId;
                console.log(`Tracking terminal ID: ${this.currentTaskTerminalId}`);
            }

            // Set up ASAN file watcher
            this.setupAsanWatcher();

            if (this.onTaskStateChangeCallback) {
                this.onTaskStateChangeCallback(true);
            }
        } else {
            console.log(`handleTaskStarted: ignoring task (background or invalid):`, taskInfo);
        }
    }

    private handleTaskEnded(taskId: number) {
        console.log(`handleTaskEnded: taskId=${taskId}, currentRunningTaskId=${this.currentRunningTask?.taskId}`);
        // Check if the ended task is our current running task
        if (this.currentRunningTask && this.currentRunningTask.taskId === taskId) {
            console.log('Task ended, resetting state');
            this.resetTaskState();
        } else {
            console.log('Task ended but it was not our tracked task, ignoring');
        }
    }

    private setupAsanWatcher() {
        // Dispose any existing watchers first
        this.disposeAsanWatcher();

        if (!this.currentFileURI) {
            return;
        }

        // Get the .asan.out file in the same directory as the current file
        const asanFileURI = this.currentFileURI.parent.resolve('.asan.out');

        // Watch for file changes
        const disposable = this.fileService.onDidFilesChange(async (event) => {
            if (event.contains(asanFileURI, FileChangeType.UPDATED) || event.contains(asanFileURI, FileChangeType.ADDED)) {
                await this.checkAsanFile(asanFileURI);
            }
        });

        this.asanWatcherDisposables.push(disposable);

        // Also check immediately in case the file already exists
        this.checkAsanFile(asanFileURI).catch(() => {
            // Silently ignore errors (file might not exist yet)
        });
    }

    private async checkAsanFile(asanFileURI: URI) {
        try {
            const fileContent = await this.fileService.read(asanFileURI);
            if (fileContent.value.includes('AddressSanitizer:DEADLYSIGNAL') || fileContent.value.includes('ABORTING')) {
                this.messageService.warn('Your program has crashed. Use debugger to find out why.');
            } else if (fileContent.value.includes('ERROR: AddressSanitizer')) {
                this.messageService.warn('Your program contains a memory error (leak, out-of-bounds access etc).');
            } else if (fileContent.value.length > 15 && !fileContent.value.includes('AddressSanitizer')) {
                this.messageService.warn('There was a problem running your file. Contact the system administrator immediately.');
            }
        } catch (err) {
            // File doesn't exist or can't be read - this is normal, silently ignore
        }
    }

    private disposeAsanWatcher() {
        this.asanWatcherDisposables.dispose();
        this.asanWatcherDisposables = new DisposableCollection();
    }

    private async verifyTaskStillRunning(taskId: number) {
        try {
            const runningTasks = await this.taskService.getRunningTasks();
            const isStillRunning = runningTasks.some(task => task.taskId === taskId);

            console.log(`verifyTaskStillRunning: taskId=${taskId}, isStillRunning=${isStillRunning}, runningTasks=${runningTasks.length}`);

            if (!isStillRunning && this.currentRunningTask && this.currentRunningTask.taskId === taskId) {
                console.log('Task ended immediately after starting, resetting state');
                this.resetTaskState();
            }
        } catch (err) {
            console.error('Error verifying task status:', err);
            // If we can't verify, assume it's not running and reset
            this.resetTaskState();
        }
    }

    private resetTaskState() {
        console.log('Resetting task state to stopped');

        // Close the terminal associated with this task
        if (this.currentTaskTerminalId !== undefined) {
            console.log(`Closing terminal ID: ${this.currentTaskTerminalId}`);
            this.closeTerminal(this.currentTaskTerminalId);
            this.currentTaskTerminalId = undefined;
        }

        this.currentRunningTask = undefined;
        this.disposeAsanWatcher();
        if (this.onTaskStateChangeCallback) {
            this.onTaskStateChangeCallback(false);
        }
    }

    private closeTerminal(terminalId: number) {
        try {
            const terminal = this.terminalService.getById(terminalId.toString());
            if (terminal) {
                console.log(`Closing terminal: ${terminal.title.label}`);
                terminal.dispose();
            } else {
                console.log(`Terminal with ID ${terminalId} not found`);
            }
        } catch (err) {
            console.error(`Error closing terminal ${terminalId}:`, err);
        }
    }

}
