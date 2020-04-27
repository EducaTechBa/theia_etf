import { ContainerModule } from 'inversify';
import { RunButtonWidget } from './run-button-widget';
import { RunButtonContribution } from './run-button-contribution';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';

import '../../src/browser/style/index.css';

export default new ContainerModule(bind => {
    bindViewContribution(bind, RunButtonContribution);
    bind(FrontendApplicationContribution).toService(RunButtonContribution);
    bind(RunButtonWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: RunButtonWidget.ID,
        createWidget: () => ctx.container.get<RunButtonWidget>(RunButtonWidget)
    })).inSingletonScope();
});
