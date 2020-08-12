import { injectable, inject } from 'inversify';
import {
    ContextMenuRenderer,
    TreeModel,
    TreeProps,
    TreeWidget,
    TreeNode,
    ExpandableTreeNode
} from "@theia/core/lib/browser";
import { CoursesRootNode, CourseNode, TutorialNode, AssignmentNode } from "./assignments-tree";
import { MessageService } from '@theia/core';

@injectable()
export class AssignmentsViewWidget extends TreeWidget {
    static readonly ID = 'assignments-view:widget';
    static readonly LABEL = 'Assignments View';

    constructor(
        @inject(TreeProps) readonly props: TreeProps,
        @inject(TreeModel) readonly model: TreeModel,
        @inject(ContextMenuRenderer) contextMenuRenderer: ContextMenuRenderer,
        @inject(MessageService) private readonly messageService: MessageService
    ) {
        super(props, model, contextMenuRenderer);

        this.id = AssignmentsViewWidget.ID;
        this.title.label = AssignmentsViewWidget.LABEL;
        this.title.caption = AssignmentsViewWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-window-maximize'; // example widget icon.

        // Data here!!!
        const coursesRoot: Courses = {
            courses: [
                {
                    name: 'RPR',
                    tutorials: [
                        {
                            name: 'Tutorijal 1',
                            assignments: [
                                {
                                    title: 'Zadatak 1',
                                    language: 'c++'
                                }
                            ]
                        }
                    ]
                },
                {
                    name: 'UUP',
                    tutorials: [
                        {
                            name: 'Tutorijal 1',
                            assignments: [
                                {
                                    title: 'Zadatak 1',
                                    language: 'c++'
                                }
                            ]
                        }
                    ]
                }
            ]
        };
        const root: CoursesRootNode = {
            id: "assignments-root",
            name: "assignments-root",
            visible: false,
            parent: undefined,
            children: [],
            courses: coursesRoot
        };

        this.model.root = root;
        // Maybe????
        // this.update();
    }

    protected handleDblClickEvent(node: TreeNode | undefined, event: React.MouseEvent<HTMLElement>): void {
        if(node && AssignmentNode.is(node)) {
            this.messageService.info(node.assignment.title);
            event.stopPropagation();
        } else {
            this.model.openNode(node);
            event.stopPropagation();
        }
    }

    protected isExpandable(node: TreeNode): node is ExpandableTreeNode {
        if (CoursesRootNode.is(node)) {
            return true;
        }

        if (CourseNode.is(node) && node.course.tutorials) {
            return node.course.tutorials.length > 0;
        }

        if (TutorialNode.is(node) && node.tutorial.assignments) {
            return node.tutorial.assignments.length > 0;
        }

        return false;
    }

}
