import { injectable, inject } from 'inversify';
import { TaskService } from '@theia/task/lib/browser';
import {
    TaskConfiguration,
    TaskScope,
    RevealKind,
    PanelKind
} from '@theia/task/lib/common/task-protocol'
import { WorkspaceService } from '@theia/workspace/lib/browser';
import URI from '@theia/core/lib/common/uri';

@injectable()
export class TaskRunner {

    constructor(
        @inject(TaskService) protected readonly taskService: TaskService,
        @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService,
    ) {}


    private getInWorkspacePath(uri: string): string {
        const workspaceUri = this.workspaceService.workspace?.resource.toString();
        return uri.slice(workspaceUri?.length);
    }

    public async runTask(fileURI: URI) {
        // TODO: Implement build and run depending on course
        //       Read tasks.json
        //       create task configurations for different directories
        //       invoke task that matches current directory

        const taskConfiguration: TaskConfiguration = {
            label: this.getInWorkspacePath(fileURI + ''),
            _scope: TaskScope.Workspace,
            type: 'shell',
            command: 'sleep 1 && echo "Hello, world"',
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
            // dependsOn: 'build',
        };

        await this.taskService.runTask(taskConfiguration);
    }

}
