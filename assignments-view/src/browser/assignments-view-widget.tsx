import { injectable, inject } from 'inversify';
import {
    ContextMenuRenderer,
    TreeModel,
    TreeProps,
    TreeWidget,
    TreeNode,
    ExpandableTreeNode
} from "@theia/core/lib/browser";
import { FamilyRootNode, MemberNode } from "./assignments-tree";

@injectable()
export class AssignmentsViewWidget extends TreeWidget {
    static readonly ID = 'assignments-view:widget';
    static readonly LABEL = 'Assignments View';

    // @postConstruct()
    // protected async init(): Promise<void> {
    //     this.id = AssignmentsViewWidget.ID;
    //     this.title.label = AssignmentsViewWidget.LABEL;
    //     this.title.caption = AssignmentsViewWidget.LABEL;
    //     this.title.closable = true;
    //     this.title.iconClass = 'fa fa-window-maximize'; // example widget icon.
    //     this.update();
    // }

    constructor(
        @inject(TreeProps) readonly props: TreeProps,
        @inject(TreeModel) readonly model: TreeModel,
        @inject(ContextMenuRenderer) contextMenuRenderer: ContextMenuRenderer
    ) {
        super(props, model, contextMenuRenderer);

        this.id = AssignmentsViewWidget.ID;
        this.title.label = AssignmentsViewWidget.LABEL;
        this.title.caption = AssignmentsViewWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-window-maximize'; // example widget icon.

        const family: Family = {
            name: "Vestrit",
            members: [
                {
                    firstName: "Ephron",
                    nickName: "Ephy",
                    children: [
                        {
                            firstName: "Keffria",
                            nickName: "Keff",
                            children: [
                                {
                                    firstName: "Wintrow",
                                    nickName: "Win"
                                },
                                {
                                    firstName: "Malta",
                                    nickName: "Ederling Queen",
                                    children: [
                                        {
                                            firstName: "Ephron Bendir",
                                            nickName: "Ben"
                                        }
                                    ]
                                },
                                {
                                    firstName: "Selden",
                                    nickName: "Ederling Prince"
                                }
                            ]
                        },
                        {
                            firstName: "Althea",
                            nickName: "Alth"
                        }
                    ]
                }
            ]
        };

        const root: FamilyRootNode = {
            id: "assignments-root",
            name: "assignments-root",
            visible: false,
            parent: undefined,
            children: [],
            family
        };

        this.model.root = root;
        // Maybe????
        // this.update();
    }

    protected isExpandable(node: TreeNode): node is ExpandableTreeNode {
        if (FamilyRootNode.is(node)) return true;

        if (MemberNode.is(node) && node.member.children)
            return node.member.children.length > 0;

        return false;
    }

}
