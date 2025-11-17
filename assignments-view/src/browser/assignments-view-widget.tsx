import { injectable, inject } from 'inversify';
import {
    ContextMenuRenderer,
    TreeModel,
    TreeProps,
    TreeWidget,
    TreeNode,
    ExpandableTreeNode,
    open,
    OpenerService
} from "@theia/core/lib/browser";
import { DirectoryRootNode, DirectoryNode, AssignmentNode } from "./assignments-tree";
import { MessageService } from '@theia/core';
import { AssignmentsDataProvider } from './assignments-data-provider';
import { AssignmentGenerator } from './assignments-generator';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { MiniBrowserOpenHandler } from '@theia/mini-browser/lib/browser/mini-browser-open-handler';
import { FileService } from '@theia/filesystem/lib/browser/file-service';

@injectable()
export class AssignmentsViewWidget extends TreeWidget {
    static readonly ID = 'assignments-view:widget';
    static readonly LABEL = 'Assignments View';

    constructor(
        @inject(TreeProps) readonly props: TreeProps,
        @inject(TreeModel) readonly model: TreeModel,
        @inject(ContextMenuRenderer) contextMenuRenderer: ContextMenuRenderer,
        @inject(MessageService) private readonly messageService: MessageService,
        @inject(WorkspaceService) private readonly workspaceService: WorkspaceService,
        @inject(OpenerService) private readonly openerService: OpenerService,
        @inject(AssignmentGenerator) private readonly assignmentGenerator: AssignmentGenerator,
        @inject(MiniBrowserOpenHandler) private readonly miniBrowserOpenHandler: MiniBrowserOpenHandler,
        @inject(FileService) private readonly fileService: FileService,
    ) {
        super(props, model, contextMenuRenderer);

        this.id = AssignmentsViewWidget.ID;
        this.title.label = AssignmentsViewWidget.LABEL;
        this.title.caption = AssignmentsViewWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-code';

        const dataProvider = new AssignmentsDataProvider();

        dataProvider
            .getCoursesData()
            .then((directories: Directory[]) => {
                if (directories.length === 0) {
                    this.messageService.info('No active courses found. If you think that this is an issue, contact your supervisor.');
                }

                this.model.root = this.makeRootNode(directories);
                this.update();
            })
            .catch(err => {
                console.log(err);
                this.messageService.info(`Failed to fetch any assignment data...`);
            });

        this.model.root = this.makeRootNode([]);
        this.update();
    }

    private makeRootNode(directories: Directory[]) {
        return {
            id: "assignments-root",
            name: "assignments-root",
            visible: false,
            parent: undefined,
            children: [],
            directories
        };
    }

    protected handleDblClickEvent(node: TreeNode | undefined, event: React.MouseEvent<HTMLElement>): void {
        if (node && AssignmentNode.is(node)) {
            this.assignmentDirectoryGeneration(node.assignment)
                .catch(err => {
                    console.log("Error occured while generating assignment resources:", err);
                    console.log("Za svaki slucaj i ovo: ", JSON.stringify(err));
                    this.messageService.info('An error occurred while generating assignment sources')
                });
            event.stopPropagation();
        } else {
            this.model.openNode(node);
            event.stopPropagation();
        }
    }

    private async assignmentDirectoryGeneration(assignment: Assignment) {
        console.log('Starting assignment generation method...')

        const workspaceRoot = this.workspaceService.workspace?.resource;
        if (!workspaceRoot) {
            this.messageService.error('No workspace is open');
            return;
        }

        const assignmentDirectoryURI = workspaceRoot.resolve(assignment.path);
        console.log('Done preparing directory uri based on assignment')

        this.messageService.info(`Generating sources for '${assignment.path}'...`);
        try {
            await this.assignmentGenerator.generateAssignmentSources(assignmentDirectoryURI.toString(), assignment)
        } catch(err) {
            console.log(`Error generating assignment sources: ${err}`);
            this.messageService.error(`Failed to generate sources: ${err}`);
            return;
        }
        this.messageService.info(`Sources for ${assignment.path} generated successfully!`);

        console.log(JSON.stringify(assignment))

        // Open files recursively from the assignment directory
        await this.openAssignmentFilesHelper(assignment.path);
        console.log('End assignment generation and opening...')
    }

    private async openAssignmentFilesHelper(path: string) {
        const workspaceRoot = this.workspaceService.workspace?.resource;
        if (!workspaceRoot) {
            this.messageService.error('No workspace is open');
            return;
        }

        const uri = workspaceRoot.resolve(path);

        let resolve;
        try {
            resolve = await this.fileService.resolve(uri);
        } catch (err) {
            console.error(`Failed to resolve directory ${path}:`, err);
            return;
        }

        if (resolve.children?.length) {
            for (const file of resolve.children) {
                if (file.name[0] === '.')
                    continue;
                else if (file.isDirectory)
                    await this.openAssignmentFilesHelper(path + "/" + file.name);
                else if (file.name.match(/.+\.html$/)) {
                    try {
                        await this.miniBrowserOpenHandler.open(file.resource);
                    } catch (err) {
                        console.error(`Failed to open HTML file ${file.name}:`, err);
                        this.messageService.error(`Failed to open ${file.name}: ${err}`);
                    }
                } else {
                    // Open all other files (C, C++, etc.) with the default editor
                    try {
                        await open(this.openerService, file.resource);
                    } catch (err) {
                        console.error(`Failed to open file ${file.name}:`, err);
                        this.messageService.error(`Failed to open ${file.name}: ${err}`);
                    }
                }
            }
        }
    }

    protected isExpandable(node: TreeNode): node is ExpandableTreeNode {
        if (DirectoryRootNode.is(node)) {
            return true;
        }

        if (DirectoryNode.is(node) && node.directory.subdirectories) {
            const dir = node.directory;
            return dir.subdirectories.length > 0 || dir.assignments.length > 0;
        }

        return false;
    }

}
