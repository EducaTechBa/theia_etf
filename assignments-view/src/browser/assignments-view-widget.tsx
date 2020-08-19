import { injectable, inject } from 'inversify';
import {
    ContextMenuRenderer,
    TreeModel,
    TreeProps,
    TreeWidget,
    TreeNode,
    ExpandableTreeNode
} from "@theia/core/lib/browser";
import { DirectoryRootNode, DirectoryNode, AssignmentNode } from "./assignments-tree";
import { MessageService } from '@theia/core';
import { AssignmentsDataProvider } from './assignments-data-provider';

@injectable()
export class AssignmentsViewWidget extends TreeWidget {
    static readonly ID = 'assignments-view:widget';
    static readonly LABEL = 'Assignments View';

    constructor(
        @inject(TreeProps) readonly props: TreeProps,
        @inject(TreeModel) readonly model: TreeModel,
        @inject(ContextMenuRenderer) contextMenuRenderer: ContextMenuRenderer,
        @inject(MessageService) private readonly messageService: MessageService,
        // @inject(AssignmentsDataProvider) private readonly dataProvider: AssignmentsDataProvider,
    ) {
        super(props, model, contextMenuRenderer);

        this.id = AssignmentsViewWidget.ID;
        this.title.label = AssignmentsViewWidget.LABEL;
        this.title.caption = AssignmentsViewWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-window-maximize';

        const dataProvider = new AssignmentsDataProvider();

        // TODO: Think of a way not to do login here
        // TODO: Clean up code
        // TODO: Implement file generation
        // TODO: Fix data model... !!!!!!! include info for generatin request for file copy
        //          Before copying file, check if file exists!
        //          Does the service handle it or do I have to???

        dataProvider.login('hstudente', 'password')
            .then(text => {
                console.log("Login Response Text: " + text);
                dataProvider
                    .getCoursesData()
                    .then((directories: Directory[]) => {
                        if (directories === []) {
                            this.messageService.info('No active courses found. If you think that this is an issue, contact your supervisor.')
                        }

                        this.model.root = this.makeRootNode(directories);
                        this.update();
                    })
                    .catch(err => {
                        this.messageService.info(`Failed to fetch any data`);
                        this.messageService.log(err.toString());
                    });
            })
            .catch(err => {
                console.log(err);
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
            this.messageService.info(node.assignment.id);
            event.stopPropagation();
        } else {
            this.model.openNode(node);
            event.stopPropagation();
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
