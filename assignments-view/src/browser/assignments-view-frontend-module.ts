import { ContainerModule } from 'inversify';
import { AssignmentsViewWidget } from './assignments-view-widget';
import { AssignmentsViewContribution } from './assignments-view-contribution';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';

import '../../src/browser/style/index.css';

export default new ContainerModule(bind => {
    bindViewContribution(bind, AssignmentsViewContribution);
    bind(FrontendApplicationContribution).toService(AssignmentsViewContribution);
    bind(AssignmentsViewWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: AssignmentsViewWidget.ID,
        createWidget: () => ctx.container.get<AssignmentsViewWidget>(AssignmentsViewWidget)
    })).inSingletonScope();
});
