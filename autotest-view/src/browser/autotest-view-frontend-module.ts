import { ContainerModule } from 'inversify';
import { AutotestViewWidget } from './autotest-view-widget';
import { AutotestViewContribution } from './autotest-view-contribution';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';

import '../../src/browser/style/index.css';
import { Autotester } from './autotester';

export default new ContainerModule(bind => {
    bindViewContribution(bind, AutotestViewContribution);
    bind(FrontendApplicationContribution).toService(AutotestViewContribution);
    bind(AutotestViewWidget).toSelf();
    bind(Autotester).toSelf().inRequestScope();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: AutotestViewWidget.ID,
        createWidget: () => ctx.container.get<AutotestViewWidget>(AutotestViewWidget)
    })).inSingletonScope();
});
