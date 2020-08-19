import {
    TreeImpl,
    CompositeTreeNode,
    TreeNode,
    ExpandableTreeNode,
    SelectableTreeNode
} from "@theia/core/lib/browser";
import { injectable } from "inversify";

@injectable()
export class AssignmentsTree extends TreeImpl {

    protected resolveChildren(parent: CompositeTreeNode): Promise<TreeNode[]> {
        if (DirectoryRootNode.is(parent)) {
            return Promise.resolve(
                parent.directories.map(dir => this.makeDirectory(dir))
            );
        }

        if (DirectoryNode.is(parent)) {
            const directories = parent.directory.subdirectories.map(dir => this.makeDirectory(dir));
            const assignments = parent.directory.assignments.map(a => this.makeAssignmentNode(a));
            return Promise.resolve([...directories, ...assignments]);
        }

        return Promise.resolve(Array.from(parent.children));
    }


    makeDirectory(dir: Directory) {
        const node: DirectoryNode = {
            id: dir.id,
            name: dir.name,
            parent: undefined,
            expanded: false,
            selected: false,
            children: [],
            directory: dir
        };
        return node;
    }

    makeAssignmentNode(a: Assignment) {
        const node: AssignmentNode = {
            id: a.id,
            name: a.name,
            parent: undefined,
            expanded: false,
            selected: false,
            children: [],
            assignment: a
        };
        return node;
    }
}

export interface DirectoryRootNode extends CompositeTreeNode {
    directories: Directory[];
}

export namespace DirectoryRootNode {
    export function is(node: object): node is DirectoryRootNode {
        return !!node && "directories" in node;
    }
}

export interface DirectoryNode extends CompositeTreeNode, ExpandableTreeNode, SelectableTreeNode {
    directory: Directory;
}

export namespace DirectoryNode {
    export function is(node: object): node is DirectoryNode {
        return !!node && "directory" in node;
    }
}

export interface AssignmentNode extends CompositeTreeNode, ExpandableTreeNode, SelectableTreeNode {
    assignment: Assignment;
}

export namespace AssignmentNode {
    export function is(node: object): node is AssignmentNode {
        return !!node && "assignment" in node;
    }
}
