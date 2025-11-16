import { ContainerModule, interfaces } from 'inversify';
import { AssignmentsViewWidget } from './assignments-view-widget';
import { AssignmentsViewContribution } from './assignments-view-contribution';
import {
    bindViewContribution,
    createTreeContainer,
    FrontendApplicationContribution,
    TreeWidget,
    WidgetFactory,
    TreeImpl,
    Tree
} from "@theia/core/lib/browser";
import { AssignmentsTree } from "./assignments-tree";
import { AssignmentGenerator } from './assignments-generator';

import '../../src/browser/style/index.css';

export default new ContainerModule(bind => {
    bindViewContribution(bind, AssignmentsViewContribution);
    bind(FrontendApplicationContribution).toService(AssignmentsViewContribution);
    bind(AssignmentGenerator).toSelf().inSingletonScope();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: AssignmentsViewWidget.ID,
        createWidget: () => createAssignmentViewWidget(ctx.container)
    })).inSingletonScope();
});

export async function createAssignmentViewWidget(parent: interfaces.Container) : Promise<AssignmentsViewWidget> {
    const child = createTreeContainer(parent);

    child.unbind(TreeImpl);
    child.bind(AssignmentsTree).toSelf();
    child.rebind(Tree).toService(AssignmentsTree);

    child.unbind(TreeWidget);
    child.bind(AssignmentsViewWidget).toSelf();

    return child.getAsync(AssignmentsViewWidget);
}
