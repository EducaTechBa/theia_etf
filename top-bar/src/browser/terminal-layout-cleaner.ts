import { injectable, inject } from 'inversify';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';

/**
 * Cleans terminal widgets from stored workspace layout on application startup.
 * This prevents terminal restoration issues where non-existent terminal IDs
 * cause RPC message floods and GB RAM usage.
 *
 * This approach modifies the stored layout BEFORE Theia's ShellLayoutRestorer
 * reads it, ensuring terminals are never in the layout data to begin with.
 */
@injectable()
export class TerminalLayoutCleaner implements FrontendApplicationContribution {

    @inject(StorageService)
    protected readonly storageService: StorageService;

    /**
     * Called during frontend initialization - we need to run as early as possible.
     * onStart() is actually too late (layout restoration starts before this).
     * We need to use initialize() instead which runs earlier.
     */
    async initialize(): Promise<void> {
        await this.cleanTerminalsFromLayout();
    }

    private async cleanTerminalsFromLayout(): Promise<void> {
        try {
            // Read the stored layout (same key ShellLayoutRestorer uses)
            const layoutData = await this.storageService.getData<string>('layout');

            if (!layoutData) {
                console.log('TerminalLayoutCleaner: No stored layout found');
                return;
            }

            // Parse the layout JSON
            const layout = JSON.parse(layoutData);
            let terminalCount = 0;

            // Function to recursively remove terminal widgets
            const cleanPanel = (panel: any): void => {
                if (!panel) return;

                // Handle DockPanel structure (mainPanel, bottomPanel.config)
                if (panel.main) {
                    cleanPanel(panel.main);
                }

                // Handle widgets array
                if (panel.widgets && Array.isArray(panel.widgets)) {
                    panel.widgets = panel.widgets.filter((widget: any) => {
                        const isTerminal = this.isTerminalWidget(widget);
                        if (isTerminal) {
                            terminalCount++;
                        }
                        return !isTerminal;
                    });

                    // If we removed all widgets and panel has no main, set widgets to empty
                    if (panel.widgets.length === 0 && !panel.main) {
                        panel.widgets = [];
                    }
                }

                // Handle children array (nested layouts)
                if (panel.children && Array.isArray(panel.children)) {
                    panel.children.forEach((child: any) => cleanPanel(child));
                }
            };

            // Clean all panels
            if (layout.mainPanel) {
                cleanPanel(layout.mainPanel);
            }

            if (layout.bottomPanel?.config) {
                cleanPanel(layout.bottomPanel.config);
            }

            // Clean side panels (different structure with items)
            if (layout.leftPanel?.items && Array.isArray(layout.leftPanel.items)) {
                layout.leftPanel.items = layout.leftPanel.items.filter((item: any) => {
                    const isTerminal = this.isTerminalWidget(item.widget);
                    if (isTerminal) {
                        terminalCount++;
                    }
                    return !isTerminal;
                });
            }

            if (layout.rightPanel?.items && Array.isArray(layout.rightPanel.items)) {
                layout.rightPanel.items = layout.rightPanel.items.filter((item: any) => {
                    const isTerminal = this.isTerminalWidget(item.widget);
                    if (isTerminal) {
                        terminalCount++;
                    }
                    return !isTerminal;
                });
            }

            if (terminalCount > 0) {
                console.log(`TerminalLayoutCleaner: Removed ${terminalCount} terminal(s) from stored layout`);

                // Save the cleaned layout back to storage
                const cleanedLayoutData = JSON.stringify(layout);
                await this.storageService.setData('layout', cleanedLayoutData);

                console.log('TerminalLayoutCleaner: Cleaned layout saved');
            } else {
                console.log('TerminalLayoutCleaner: No terminals found in layout');
            }

        } catch (error) {
            console.error('TerminalLayoutCleaner: Error cleaning layout:', error);
            // Don't throw - better to have terminals restored than crash the app
        }
    }

    private isTerminalWidget(widget: any): boolean {
        if (!widget) {
            return false;
        }

        // Check construction options for terminal factory ID
        if (widget.constructionOptions?.factoryId === 'terminal') {
            return true;
        }

        // Check widget property
        if (widget.widget === 'terminal') {
            return true;
        }

        // Check inner widget
        if (widget.inner?.widget === 'terminal') {
            return true;
        }

        return false;
    }
}
