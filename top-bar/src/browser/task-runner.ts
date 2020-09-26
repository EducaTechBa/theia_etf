import { injectable, inject, postConstruct } from 'inversify';
import { TaskService } from '@theia/task/lib/browser';
import {
    TaskConfiguration,
    TaskScope,
    RevealKind,
    PanelKind
} from '@theia/task/lib/common/task-protocol'
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import URI from '@theia/core/lib/common/uri';

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

    @inject(TaskService)
    protected readonly taskService: TaskService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(FileService)
    protected readonly fileService: FileService;

    @postConstruct()
    // @ts-ignore
    private async init() {
        const path = `${this.workspaceService.workspace?.resource.toString()}${this.RELATIVE_TASK_CONFIG_JSON_PATH}`;
        const jsonURI = new URI(path);
        this.directoryTasks = await this.loadDirectoryTaskConfigFromJson(jsonURI);
    }

    private async loadDirectoryTaskConfigFromJson(fileURI: URI): Promise<DirectoryTasks> {
        try {
            const fileContent = await this.fileService.read(fileURI);
            const directoryTasks = JSON.parse(fileContent.value) as DirectoryTasks;
            return directoryTasks;
        } catch (err) {
            // TODO: Show error message via messageService...
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
        await this.taskService.runTask(runTask);
    }

}
