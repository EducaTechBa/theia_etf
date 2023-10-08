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
import URI from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { RetriableOperation } from './retriable-operation';
import { FileOperationError, FileOperationResult } from '@theia/filesystem/lib/common/files';

@injectable()
export class AssignmentsViewWidget extends TreeWidget {
    static readonly ID = 'assignments-view:widget';
    static readonly LABEL = 'Assignments View';

    private readonly RETRY_TIMEOUT_MS = 1000;

    constructor(
        @inject(TreeProps) readonly props: TreeProps,
        @inject(TreeModel) readonly model: TreeModel,
        @inject(ContextMenuRenderer) contextMenuRenderer: ContextMenuRenderer,
        @inject(MessageService) private readonly messageService: MessageService,
        @inject(WorkspaceService) private readonly workspaceService: WorkspaceService,
        @inject(FileService) private readonly fileService: FileService,
        @inject(OpenerService) private readonly openerService: OpenerService,
        @inject(AssignmentGenerator) private readonly assignmentGenerator: AssignmentGenerator,
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
                if (directories === []) {
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
        const workspaceURI = this.workspaceService.workspace?.resource || '';
        const assignmentDirectoryPath = `${workspaceURI}/${assignment.path}`;
        const assignmentDirectoryURI = new URI(assignmentDirectoryPath);
        console.log('Done preparing directory uri based on assignemnt')

        this.messageService.info(`Generating sources for '${assignment.path}'...`);
        try {
            await this.assignmentGenerator.generateAssignmentSources(assignmentDirectoryURI, assignment)
        } catch(err) {
            console.log(`Error generating assignment sources: ${err}`);
         }
        this.messageService.info(`Sources for ${assignment.path} generated successfully!`);
        
        console.log(JSON.stringify(assignment))

        assignment.files
            .filter(file => file.show)
            .forEach(async file => {
                try {
                    const fileURI = new URI(`${assignmentDirectoryPath}/${file.filename}`);
                    const operation = () => open(this.openerService, fileURI);
                    const retriable = new RetriableOperation(operation, this.RETRY_TIMEOUT_MS);
                    await retriable.run()
                } catch(err) {
                    console.log(`Error opening file: ${err}`)
                }
            });
        console.log('End assignment generation and opening...')
    }

    private async generateAssignmentSources(assignmentDirectoryPath: string, assignment: Assignment) {
        this.messageService.info(`Generating sources for '${assignment.path}'...`);
        try {
            await this.assignmentGenerator.generateAssignmentSources(assignmentDirectoryPath, assignment)
        } catch(err) {
            console.log(`Error generating assignment sources: ${err}`);
        }
        this.messageService.info(`Sources for ${assignment.path} generated successfully!`);
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
