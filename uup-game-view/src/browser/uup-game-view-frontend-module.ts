import { ContainerModule } from 'inversify';
import { UupGameViewWidget } from './uup-game-view-widget';
import { UupGameViewContribution } from './uup-game-view-contribution';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';

import '../../src/browser/style/index.css';

export default new ContainerModule(bind => {
    bindViewContribution(bind, UupGameViewContribution);
    bind(FrontendApplicationContribution).toService(UupGameViewContribution);
    bind(UupGameViewWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: UupGameViewWidget.ID,
        createWidget: () => ctx.container.get<UupGameViewWidget>(UupGameViewWidget)
    })).inSingletonScope();
});
