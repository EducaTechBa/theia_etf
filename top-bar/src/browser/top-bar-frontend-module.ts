import { ContainerModule } from 'inversify';
import { TopBarWidget } from './top-bar-widget';
import { TopBarContribution } from './top-bar-contribution';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';

import '../../src/browser/style/index.css';
import { HomeworkSubmit } from './homework-submit';
import { TaskRunner } from './task-runner';
import { SessionManager } from './session-manager';

export default new ContainerModule(bind => {
    bindViewContribution(bind, TopBarContribution);
    bind(FrontendApplicationContribution).toService(TopBarContribution);
    bind(TopBarWidget).toSelf();
    bind(HomeworkSubmit).toSelf().inSingletonScope();
    bind(TaskRunner).toSelf().inSingletonScope();
    bind(SessionManager).toSelf().inSingletonScope();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: TopBarWidget.ID,
        createWidget: () => ctx.container.getAsync<TopBarWidget>(TopBarWidget)
    })).inSingletonScope();
});
