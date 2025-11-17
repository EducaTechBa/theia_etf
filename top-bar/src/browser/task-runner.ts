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

    @postConstruct()
    // @ts-ignore
    private async init() {
        const path = `${this.workspaceService.workspace?.resource.toString()}${this.RELATIVE_TASK_CONFIG_JSON_PATH}`;
        const jsonURI = new URI(path);
        this.directoryTasks = await this.loadDirectoryTaskConfigFromJson(jsonURI);

        // Subscribe to task events
        // Use onTaskCreated instead of onDidStartTaskProcess as it's more reliable
        this.taskWatcher.onTaskCreated(taskInfo => {
            this.handleTaskStarted(taskInfo);
        });

        this.taskWatcher.onDidEndTaskProcess(taskEvent => {
            this.handleTaskEnded(taskEvent.taskId);
        });
    }

    private async loadDirectoryTaskConfigFromJson(fileURI: URI): Promise<DirectoryTasks> {
        try {
            const fileContent = await this.fileService.read(fileURI);
            const directoryTasks = JSON.parse(fileContent.value) as DirectoryTasks;
            return directoryTasks;
        } catch (err) {
            // TODO: Show error message via messageService...
            console.log(`Could not load TaskDirectoryConfiguration: ${err}`);
            return {};
        }
    }

    private createTaskConfigration(label: string, command: string, isBackground?: boolean, dependsOn?: string): TaskConfiguration {
        return {
            label,
            _scope: TaskScope.Workspace,
            type: 'shell',
            command,
            options: {
                cwd: "${fileDirname}"
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
        // Store the current file URI for ASAN watcher
        this.currentFileURI = fileURI;

        const inWorkspacePath = this.getInWorkspacePath(fileURI + '');

        const { build, run } = this.getTaskCommandsByPath(inWorkspacePath);

        const buildTaskLabel = `Build ${inWorkspacePath}`;
        const runTaskLabel = `Run ${inWorkspacePath}`;

        if (build) {
            const buildTask = this.createTaskConfigration(buildTaskLabel, build, true);
            await this.taskService.runTask(buildTask);
        }

        const dependsOn = build ? buildTaskLabel : undefined;

        const runTask = this.createTaskConfigration(runTaskLabel, run, false, dependsOn);
        const taskInfo = await this.taskService.runTask(runTask);

        // Call handleTaskStarted directly since events might have already fired
        if (taskInfo) {
            console.log("runTask returned taskInfo:", taskInfo);
            this.handleTaskStarted(taskInfo);
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
            }
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
        if (taskInfo && !taskInfo.config.isBackground) {
            this.currentRunningTask = taskInfo;

            // Set up ASAN file watcher
            this.setupAsanWatcher();

            if (this.onTaskStateChangeCallback) {
                this.onTaskStateChangeCallback(true);
            }
        }
    }

    private handleTaskEnded(taskId: number) {
        // Check if the ended task is our current running task
        if (this.currentRunningTask && this.currentRunningTask.taskId === taskId) {
            this.currentRunningTask = undefined;

            // Clean up ASAN file watcher
            this.disposeAsanWatcher();

            if (this.onTaskStateChangeCallback) {
                this.onTaskStateChangeCallback(false);
            }
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
            if (fileContent.value.includes('AddressSanitizer:DEADLYSIGNAL')) {
                this.messageService.info('Your program has crashed. Use debugger to find out why.');
            }
        } catch (err) {
            // File doesn't exist or can't be read - this is normal, silently ignore
        }
    }

    private disposeAsanWatcher() {
        this.asanWatcherDisposables.dispose();
        this.asanWatcherDisposables = new DisposableCollection();
    }

}
