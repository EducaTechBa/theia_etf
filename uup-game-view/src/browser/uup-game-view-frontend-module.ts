import { ContainerModule } from 'inversify';
import { UupGameViewWidget } from './uup-game-view-widget';
import { UupGameViewContribution } from './uup-game-view-contribution';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';

import '../../src/browser/style/index.css';
import { GameService } from './uup-game-service';
import { GameServiceV11 } from './uup-game-service-v11';

export default new ContainerModule(bind => {
    bindViewContribution(bind, UupGameViewContribution);
    bind(FrontendApplicationContribution).toService(UupGameViewContribution);
    bind(UupGameViewWidget).toSelf();
    bind(GameService).toSelf().inSingletonScope();
    bind(GameServiceV11).toSelf().inSingletonScope();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: UupGameViewWidget.ID,
        createWidget: () => ctx.container.getAsync<UupGameViewWidget>(UupGameViewWidget)
    })).inSingletonScope();
});
