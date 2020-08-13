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
        // Create three layers of Nodes: Course, Tutorial, Assignment

        // From the CoursesRootNode create CourseNodes children
        if (CoursesRootNode.is(parent)) {
            return Promise.resolve(
                // Better naming...
                parent.courses.courses.map(c => this.makeCourseNode(c))
            );
        }

        // From the CourseNode create TutorialNode children
        if (CourseNode.is(parent)) {
            return Promise.resolve(
                parent.course.tutorials?.map(t => this.makeTutorialNode(t)) || []
            );
        } 

        // From the TutorialNode create AssignmentNode children
        if (TutorialNode.is(parent)) {
            return Promise.resolve(
                parent.tutorial.assignments?.map(a => this.makeAssignmentNode(a)) || []
            );
        }

        return Promise.resolve(Array.from(parent.children));
    }

    makeCourseNode(c: Course) {
        const node: CourseNode = {
            id: c.id,
            name: c.name,
            parent: undefined,
            expanded: false,
            selected: false,
            children: [],
            course: c
        };
        return node;
    }

    makeTutorialNode(t: Tutorial) {
        const node: TutorialNode = {
            id: t.id,
            name: t.name,
            parent: undefined,
            expanded: false,
            selected: false,
            children: [],
            tutorial: t
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

export interface CoursesRootNode extends CompositeTreeNode {
    courses: Courses;
}

export namespace CoursesRootNode {
    export function is(node: object): node is CoursesRootNode {
        return !!node && "courses" in node;
    }
}

export interface CourseNode extends CompositeTreeNode, ExpandableTreeNode, SelectableTreeNode {
    course: Course;
}

export namespace CourseNode {
    export function is(node: object): node is CourseNode {
        return !!node && "course" in node;
    }
}

// Maybe not SelectableTreeNode???
export interface TutorialNode extends CompositeTreeNode, ExpandableTreeNode, SelectableTreeNode {
    tutorial: Tutorial;
}

export namespace TutorialNode {
    export function is(node: object): node is TutorialNode {
        return !!node && "tutorial" in node;
    }
}

// Maybe not Expandable and Composite???
export interface AssignmentNode extends CompositeTreeNode, ExpandableTreeNode, SelectableTreeNode {
    assignment: Assignment;
}

export namespace AssignmentNode {
    export function is(node: object): node is AssignmentNode {
        return !!node && "assignment" in node;
    }
}
