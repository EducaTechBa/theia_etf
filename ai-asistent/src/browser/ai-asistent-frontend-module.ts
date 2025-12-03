import { ContainerModule } from 'inversify';
import { AiAsistentWidget } from './ai-asistent-widget';
import { AiAsistentContribution } from './ai-asistent-contribution';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';

import '../../src/browser/style/index.css';

export default new ContainerModule(bind => {
    bindViewContribution(bind, AiAsistentContribution);
    bind(FrontendApplicationContribution).toService(AiAsistentContribution);
    bind(AiAsistentWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: AiAsistentWidget.ID,
        createWidget: () => ctx.container.getAsync<AiAsistentWidget>(AiAsistentWidget)
    })).inSingletonScope();
});
