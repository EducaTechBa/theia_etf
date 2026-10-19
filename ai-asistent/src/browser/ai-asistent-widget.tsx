import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { Message } from '@lumino/messaging';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { EditorManager } from '@theia/editor/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { MiniBrowserOpenHandler } from '@theia/mini-browser/lib/browser/mini-browser-open-handler';
import URI from '@theia/core/lib/common/uri';
import { comingSoonImage, friendlyAssistantImage, tiredAssistantImage } from './encoded-images';
import MarkdownIt = require('markdown-it');
import { t, Language, Translations } from './translations';
import { AIAsistentService } from './ai-asistent-service';
import { WarningContext, ResponseType } from './ai-asistent-types';

// Compile-time switch for the V2 backend (still in testing). Flip to false to revert to V1 behavior.
const V2 = true;

@injectable()
export class AiAsistentWidget extends ReactWidget {

    static readonly ID = 'ai-asistent:widget';
    static readonly LABEL = 'AI Assistant';

    @inject(EditorManager)
    protected readonly editorManager!: EditorManager;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(FileService)
    protected readonly fileService: FileService;

    @inject(TerminalService)
    protected readonly terminalService: TerminalService;

    @inject(MiniBrowserOpenHandler)
    protected readonly miniBrowserOpenHandler: MiniBrowserOpenHandler;

    @inject(AIAsistentService)
    protected readonly aiService!: AIAsistentService;

    private isAvailable: boolean = false;
    private isChecking: boolean = true;
    private aiResponse: string = '';
    private errorMessage: string = '';
    private isProcessing: boolean = false;
    private quotaExceeded: boolean = false;

    // Typing effect state
    private typingQueue: string = ''; // Buffer for text waiting to be typed
    private isTyping: boolean = false; // Whether typing animation is in progress
    private typingIntervalId: number | undefined; // Interval ID for typing animation

    // Markdown renderer for AI responses
    private readonly markdownRenderer: MarkdownIt;

    // Multi-step form state for "Program output is wrong"
    private outputWrongStep: number = 0; // 0=not started, 1=instructions, 2=input form, 3=expected output form
    private currentCode: string = '';
    private currentPath: string = '';
    private currentTask: string = '';
    private userInput: string = '';
    private programOutput: string = '';
    private expectedOutput: string = '';
    private showInstructions: boolean = true; // Show instructions by default
    private readonly INSTRUCTIONS_DISMISSED_KEY = 'ai-assistant-output-instructions-dismissed';

    // Crash warning state
    private showCrashWarning: boolean = false;
    private crashCode: string = '';
    private crashPath: string = '';
    private crashTask: string = '';

    // User feedback state
    private feedbackGiven: boolean = false;
    private showFeedbackThankYou: boolean = false;
    private isProcessingFeedback: boolean = false;
    private isProfessorResponse: boolean = false;

    // Warning state for various validation checks
    private showWhitespaceWarning: boolean = false;
    private showCompileWarnWarning: boolean = false;
    private showStaleGccWarning: boolean = false;
    private showStaleAsanWarning: boolean = false;
    private warningContext: WarningContext = {}; // Store context for "Proceed anyway" actions

    // Response type selector state (V2 backend)
    private showResponseTypeSelector: boolean = false;
    private pendingResponseAction: ((responseType?: ResponseType) => Promise<void>) | undefined = undefined;

    // Tracks which "screen" was last rendered, so we can scroll to top on real transitions
    // (button clicks, steps, results arriving) without resetting scroll on every typing-animation tick.
    private lastScreenKey: string = '';

    // Localization
    private language: Language = 'bs'; // Default to Bosnian

    constructor() {
        super();
        // Initialize markdown renderer with safe settings
        this.markdownRenderer = new MarkdownIt({
            html: false, // Disable raw HTML for security
            linkify: true, // Auto-convert URLs to links
            typographer: true, // Enable smart quotes and other typographic replacements
            breaks: true // Convert \n to <br>
        });
    }

    /**
     * Toggle between English and Bosnian
     */
    private toggleLanguage() {
        this.language = this.language === 'en' ? 'bs' : 'en';
        this.update();
    }

    /**
     * Intercepts clicks on links inside the rendered AI response (markdown links and
     * auto-linkified bare URLs) and opens them in Theia's own mini-browser preview
     * (central area) instead of navigating the IDE tab away to an external page.
     */
    private handleResponseLinkClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const anchor = (event.target as HTMLElement).closest('a');
        if (!anchor || !anchor.href) {
            return;
        }
        event.preventDefault();
        this.miniBrowserOpenHandler.open(MiniBrowserOpenHandler.PREVIEW_URI, {
            startPage: anchor.href,
            toolbar: 'show',
            openFor: 'preview'
        });
    };

    /**
     * Handler for partial AI response (typing effect)
     * Queues new text for character-by-character animation
     */
    private handlePartialResponse = (partialText: string) => {
        // Add new text to the queue
        this.typingQueue += partialText;

        // Start typing animation if not already running
        if (!this.isTyping) {
            this.startTypingAnimation();
        }
    };

    /**
     * Start the character-by-character typing animation
     */
    private startTypingAnimation() {
        if (this.isTyping) {
            return; // Already typing
        }

        this.isTyping = true;
        const TYPING_DELAY_MS = 50; // 50ms between characters

        this.typingIntervalId = window.setInterval(() => {
            if (this.typingQueue.length > 0) {
                // Take first character from queue and add to response
                const nextChar = this.typingQueue.charAt(0);
                this.typingQueue = this.typingQueue.substring(1);
                this.aiResponse += nextChar;
                this.update();
            } else {
                // Queue is empty, stop typing
                this.stopTypingAnimation();
            }
        }, TYPING_DELAY_MS);
    }

    /**
     * Stop the typing animation
     */
    private stopTypingAnimation() {
        if (this.typingIntervalId !== undefined) {
            window.clearInterval(this.typingIntervalId);
            this.typingIntervalId = undefined;
        }
        this.isTyping = false;
    }

    /**
     * Clear typing state and stop animation
     */
    private clearTypingState() {
        this.stopTypingAnimation();
        this.typingQueue = '';
    }

    /**
     * Flush typing queue immediately - used when final response is received
     */
    private flushTypingQueue() {
        if (this.typingQueue.length > 0) {
            this.aiResponse += this.typingQueue;
            this.typingQueue = '';
        }
        this.stopTypingAnimation();
    };

    @postConstruct()
    protected async init(): Promise<void> {
        this.id = AiAsistentWidget.ID;
        this.title.label = AiAsistentWidget.LABEL;
        this.title.caption = AiAsistentWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-lightbulb-o';

        // Load instruction preference
        const dismissed = localStorage.getItem(this.INSTRUCTIONS_DISMISSED_KEY);
        this.showInstructions = dismissed !== 'true';

        // Check if AI assistant is available
        await this.checkAvailability();

        this.update();
    }

    /**
     * V2 backend: after existing validation checks pass, let the user pick the desired
     * kind of assistance (hint / book chapters / worked examples) before submitting.
     * When V2 is off, submits immediately without asking.
     */
    private async gateResponseType(action: (responseType?: ResponseType) => Promise<void>): Promise<void> {
        if (V2) {
            this.pendingResponseAction = action;
            this.showResponseTypeSelector = true;
            this.isProcessing = false;
            this.update();
        } else {
            await action(undefined);
        }
    }

    private async chooseResponseType(responseType: ResponseType): Promise<void> {
        const action = this.pendingResponseAction;
        this.showResponseTypeSelector = false;
        this.pendingResponseAction = undefined;
        if (action) {
            await action(responseType);
        }
    }

    /**
     * Identifies the current "screen" (which step/state is shown), ignoring the growing
     * aiResponse text itself so per-character typing-animation ticks don't count as transitions.
     */
    private computeScreenKey(): string {
        return JSON.stringify([
            this.isChecking,
            this.isAvailable,
            this.quotaExceeded,
            this.isProcessing,
            this.outputWrongStep,
            this.showCrashWarning,
            this.showWhitespaceWarning,
            this.showCompileWarnWarning,
            this.showStaleGccWarning,
            this.showStaleAsanWarning,
            this.showResponseTypeSelector,
            !!this.aiResponse,
            !!this.errorMessage,
            this.isProcessingFeedback,
            this.feedbackGiven,
            this.showFeedbackThankYou,
            this.isProfessorResponse
        ]);
    }

    /**
     * Scrolls the panel back to the top. Called after every screen transition so that
     * important information isn't left hidden below the fold from a previous screen's scroll position.
     */
    private scrollContentToTop(): void {
        this.node.scrollTop = 0;
        const container = this.node.querySelector('#ai-assistant-container');
        if (container) {
            container.scrollTop = 0;
        }
    }

    protected onUpdateRequest(msg: Message): void {
        const screenKey = this.computeScreenKey();
        super.onUpdateRequest(msg);
        if (screenKey !== this.lastScreenKey) {
            this.lastScreenKey = screenKey;
            this.scrollContentToTop();
        }
    }

    private async checkAvailability(): Promise<void> {
        try {
            const response = await fetch('/api/v1/ai/asistent?action=isAvailable', {
                credentials: 'include'
            });

            // AI is available only if response is 2xx
            this.isAvailable = response.ok;

            if (this.isAvailable) {
                console.log('AI Assistant: Service is available');
            } else {
                console.log(`AI Assistant: Service not available (status: ${response.status})`);
            }
        } catch (error) {
            console.warn('AI Assistant: Failed to check availability', error);
            this.isAvailable = false;
        } finally {
            this.isChecking = false;
            this.update();
        }
    }

    protected render(): React.ReactNode {
        // Show loading state while checking
        if (this.isChecking) {
            return <div id='ai-assistant-container' style={{ textAlign: 'center', padding: '20px' }}>
                <p>Checking AI Assistant availability...</p>
            </div>;
        }

        // Show "coming soon" image if not available
        if (!this.isAvailable) {
            return <div id='ai-assistant-container' style={{ textAlign: 'center' }}>
                <img
                    src={comingSoonImage}
                    alt="AI Assistant Coming Soon"
                    style={{ maxWidth: '100%', height: 'auto' }}
                />
            </div>;
        }

        // Show quota exceeded message
        if (this.quotaExceeded) {
            return <div id='ai-assistant-container' style={{ textAlign: 'center', padding: '20px' }}>
                <img
                    src={tiredAssistantImage}
                    alt="AI Assistant Tired"
                    style={{ maxWidth: '80%', height: 'auto', marginBottom: '20px' }}
                />
                <h2 style={{ fontSize: '20px', marginBottom: '15px', color: 'var(--theia-errorForeground)' }}>
                    {t(this.language, 'quotaTitle')}
                </h2>
                <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--theia-foreground)', opacity: 0.8 }}>
                    {t(this.language, 'quotaMessage')}
                </p>
                <button
                    className="theia-button"
                    onClick={() => this.clearResponse()}
                    style={{ marginTop: '20px' }}
                >
                    {t(this.language, 'back')}
                </button>
            </div>;
        }

        // Show normal AI assistant interface if available
        return <div id='ai-assistant-container'>
            {/* Language toggle - always visible */}
            <div style={{ textAlign: 'right', padding: '10px' }}>
                <button
                    className="theia-button secondary"
                    onClick={() => this.toggleLanguage()}
                    style={{ fontSize: '12px' }}
                    title={this.language === 'en' ? 'Switch to Bosnian/Croatian/Serbian' : 'Prebaci na engleski'}
                >
                    {this.language === 'en' ? '🇧🇦 Bosanski/Hrvatski/Srpski' : '🇬🇧 English'}
                </button>
            </div>

            {!this.isProcessing && !this.aiResponse && !this.errorMessage && this.outputWrongStep === 0 &&
             !this.showCrashWarning && !this.showWhitespaceWarning && !this.showCompileWarnWarning &&
             !this.showStaleGccWarning && !this.showStaleAsanWarning && !this.showResponseTypeSelector && (
                <>
                    <div className='ai-assistant-greeting' style={{ textAlign: 'center' }}>
                        <img
                            src={friendlyAssistantImage}
                            alt="AI Teaching Assistant"
                            style={{ maxWidth: '100%', height: 'auto', marginBottom: '10px' }}
                        />
                        <h3>{t(this.language, 'greeting')}</h3>
                        <p>{t(this.language, 'question')}</p>
                    </div>

                    <div className='ai-assistant-buttons'>
                        {this.renderHelpButton('compile-error', t(this.language, 'compileError'), 'fa fa-exclamation-triangle')}
                        {this.renderHelpButton('wrong-output', t(this.language, 'wrongOutput'), 'fa fa-bug')}
                        {this.renderHelpButton('crashing', t(this.language, 'crashing'), 'fa fa-bomb')}
                        {this.renderHelpButton('tests-failing', t(this.language, 'testsFailing'), 'fa fa-times-circle')}
                    </div>
                </>
            )}

            {!this.isProcessing && this.outputWrongStep === 1 && this.renderOutputInstructions()}
            {!this.isProcessing && this.outputWrongStep === 2 && this.renderOutputWrongInputForm()}
            {!this.isProcessing && this.outputWrongStep === 3 && this.renderOutputWrongExpectedForm()}

            {this.showResponseTypeSelector && this.renderResponseTypeSelector()}
            {this.showCrashWarning && this.renderCrashWarning()}
            {this.showWhitespaceWarning && this.renderGenericWarning('whitespaceWarningTitle', 'whitespaceWarningMessage', () => this.proceedWithWhitespaceWarning())}
            {this.showCompileWarnWarning && this.renderGenericWarning('compileWarnTitle', 'compileWarnMessage', () => this.proceedWithCompileWarnWarning())}
            {this.showStaleGccWarning && this.renderGenericWarning('staleGccTitle', 'staleGccMessage', () => this.proceedWithStaleGccWarning())}
            {this.showStaleAsanWarning && this.renderGenericWarning('staleAsanTitle', 'staleAsanMessage', () => this.proceedWithStaleAsanWarning())}

            {this.isProcessing && (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="ai-spinner"></div>
                    <p className="ai-spinner-text">{t(this.language, 'processing')}</p>
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        .ai-spinner {
                            display: inline-block;
                            width: 40px;
                            height: 40px;
                            border: 4px solid var(--theia-editor-background);
                            border-top: 4px solid var(--theia-focusBorder);
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                            margin-bottom: 20px;
                        }
                        .ai-spinner-text {
                            font-size: 14px;
                            color: var(--theia-foreground);
                            opacity: 0.8;
                        }
                    `}</style>
                </div>
            )}

            {this.errorMessage && (
                <div style={{ padding: '15px' }}>
                    <h4 style={{ color: '#f44336', marginBottom: '10px' }}>{t(this.language, 'error')}</h4>
                    <p style={{ color: '#d32f2f' }}>{this.errorMessage}</p>
                    <button
                        className="theia-button"
                        onClick={() => this.clearResponse()}
                        style={{ marginTop: '10px' }}
                    >
                        {t(this.language, 'back')}
                    </button>
                </div>
            )}

            {this.isProcessingFeedback && (
                <div style={{ padding: '15px', textAlign: 'center' }}>
                    <div style={{ marginBottom: '15px' }}>
                        <i className="fa fa-spinner fa-spin" style={{ fontSize: '32px', color: '#007ACC' }}></i>
                    </div>
                    <p style={{ fontSize: '14px', color: '#888' }}>
                        {t(this.language, 'feedbackProcessing')}
                    </p>
                </div>
            )}

            {this.aiResponse && !this.isProcessingFeedback && (
                <div style={{ padding: '15px' }}>
                    <h4 style={{ marginBottom: '10px' }}>
                        {t(this.language, this.isProfessorResponse ? 'aiProfessorResponse' : 'aiResponse')}
                    </h4>
                    <div
                        className="ai-response-content"
                        onClick={this.handleResponseLinkClick}
                        dangerouslySetInnerHTML={{ __html: this.markdownRenderer.render(this.aiResponse) }}
                    />

                    {/* User feedback buttons */}
                    {this.renderFeedbackButtons()}

                    <button
                        className="theia-button"
                        onClick={() => this.clearResponse()}
                        style={{ marginTop: '15px' }}
                    >
                        {t(this.language, 'back')}
                    </button>
                </div>
            )}
        </div>
    }

    private renderHelpButton(topicId: string, text: string, iconClass: string): React.ReactNode {
        return <button
            className="theia-button ai-help-button"
            onClick={() => this.handleHelpButtonClick(topicId)}
        >
            <i className={`button-icon ${iconClass}`} aria-hidden="true"></i>
            <span>{text}</span>
        </button>
    }

    private clearResponse() {
        this.clearTypingState(); // Stop any ongoing typing animation
        this.aiResponse = '';
        this.errorMessage = '';
        this.quotaExceeded = false;
        this.outputWrongStep = 0;
        this.currentCode = '';
        this.currentPath = '';
        this.currentTask = '';
        this.userInput = '';
        this.programOutput = '';
        this.expectedOutput = '';
        this.showCrashWarning = false;
        this.crashCode = '';
        this.crashPath = '';
        this.crashTask = '';
        this.feedbackGiven = false;
        this.showFeedbackThankYou = false;
        this.isProcessingFeedback = false;
        this.isProfessorResponse = false;
        this.showWhitespaceWarning = false;
        this.showCompileWarnWarning = false;
        this.showStaleGccWarning = false;
        this.showStaleAsanWarning = false;
        this.warningContext = {};
        this.showResponseTypeSelector = false;
        this.pendingResponseAction = undefined;
        this.update();
    }

    private getRelativePath(fileUri: URI): string {
        const workspaceRoot = this.workspaceService.workspace?.resource;
        if (!workspaceRoot) {
            return fileUri.toString();
        }

        const absolutePath = fileUri.toString();
        const workspaceRootPath = workspaceRoot.toString();

        return absolutePath.startsWith(workspaceRootPath)
            ? absolutePath.substring(workspaceRootPath.length)
            : absolutePath;
    }

    /**
     * Get task specification from task.html in the same directory as the file
     */
    private async getTaskSpecification(fileUri: URI): Promise<string> {
        try {
            const fileDir = fileUri.parent;
            return await this.aiService.readTaskSpecification(fileDir);
        } catch (error) {
            console.warn('AI Assistant: Error reading task specification', error);
            return '';
        }
    }

    private renderOutputInstructions(): React.ReactNode {
        const instructions = this.language === 'bs' ? {
            title: '📋 Kako pripremiti ulaz i izlaz',
            step1: 'Pokrenite svoj program prvo',
            step1Desc: 'Kliknite na "Run" dugme i unesite ulaz kada se od vas zatraži',
            step2: 'Kopirajte ulaz iz terminala',
            step2Desc: 'Selektujte i kopirajte TAČNO ono što ste ukucali (npr. "5 3")',
            step2Example: '5 3',
            step2ExampleLabel: '← Kopirajte ovo',
            step3: 'Kopirajte stvarni izlaz iz terminala',
            step3Desc: 'Selektujte i kopirajte ono što je vaš program ispisao (NE kod!)',
            step3Example: '7',
            step3ExampleLabel: '← Kopirajte ovo',
            step4: 'Kopirajte očekivani izlaz iz zadatka',
            step4Desc: 'Pogledajte opis zadatka da vidite šta bi izlaz trebao biti',
            step4Example: 'Očekivano: ',
            step4ExampleValue: '8',
            mistakesTitle: 'Česte greške',
            mistake1: 'Nikada ne zalijepite KOD u polja za izlaz - samo zalijepite ono što je program ISPISAO',
            mistake2: 'Kopirajte iz terminala, a ne iz memorije',
            mistake3: 'Kopirajte tačno - razmaci i novi redovi su bitni',
            mistake4: 'Za opća pitanja, koristite forum kursa ili konsultacije',
            dontShowAgain: 'Ne prikazuj ovo ponovo',
            iUnderstand: 'Razumijem - Nastavi'
        } : {
            title: '📋 How to prepare Input and Output',
            step1: 'Run your program first',
            step1Desc: 'Click the "Run" button and enter input when prompted',
            step2: 'Copy input from terminal',
            step2Desc: 'Select and copy EXACTLY what you typed (e.g., "5 3")',
            step2Example: '5 3',
            step2ExampleLabel: '← Copy this',
            step3: 'Copy actual output from terminal',
            step3Desc: 'Select and copy what your program printed (NOT the code!)',
            step3Example: '7',
            step3ExampleLabel: '← Copy this',
            step4: 'Copy expected output from assignment',
            step4Desc: 'Look at the assignment description for what the output should be',
            step4Example: 'Expected: ',
            step4ExampleValue: '8',
            mistakesTitle: 'Common Mistakes',
            mistake1: 'Never paste CODE in the output fields - only paste what the program PRINTED',
            mistake2: 'Copy from terminal, not from memory',
            mistake3: 'Copy exactly - spaces and newlines matter',
            mistake4: 'For general questions, use course forum or office hours',
            dontShowAgain: 'Don\'t show this again',
            iUnderstand: 'I Understand - Continue'
        };

        return <div style={{ padding: '15px', backgroundColor: 'var(--theia-editor-background)' }}>
            <h4 style={{ marginBottom: '15px', color: 'var(--theia-focusBorder)' }}>
                {instructions.title}
            </h4>

            {/* Visual step-by-step guide */}
            <div style={{ marginBottom: '20px' }}>
                {/* Step 1 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{
                        backgroundColor: 'var(--theia-focusBorder)',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '10px',
                        flexShrink: 0
                    }}>1</div>
                    <div>
                        <strong>{instructions.step1}</strong>
                        <p style={{ fontSize: '12px', opacity: 0.8, margin: '4px 0 0 0' }}>
                            {instructions.step1Desc}
                        </p>
                    </div>
                </div>

                {/* Step 2 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{
                        backgroundColor: 'var(--theia-focusBorder)',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '10px',
                        flexShrink: 0
                    }}>2</div>
                    <div style={{ flexGrow: 1 }}>
                        <strong>{instructions.step2}</strong>
                        <p style={{ fontSize: '12px', opacity: 0.8, margin: '4px 0 0 0' }}>
                            {instructions.step2Desc}
                        </p>
                        <div style={{
                            backgroundColor: '#1e1e1e',
                            padding: '8px',
                            marginTop: '6px',
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            border: '1px solid #444',
                            borderRadius: '3px'
                        }}>
                            $ ./program<br />
                            <span style={{ color: '#4EC9B0' }}>{instructions.step2Example}</span> {instructions.step2ExampleLabel}
                        </div>
                    </div>
                </div>

                {/* Step 3 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{
                        backgroundColor: 'var(--theia-focusBorder)',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '10px',
                        flexShrink: 0
                    }}>3</div>
                    <div style={{ flexGrow: 1 }}>
                        <strong>{instructions.step3}</strong>
                        <p style={{ fontSize: '12px', opacity: 0.8, margin: '4px 0 0 0' }}>
                            {instructions.step3Desc}
                        </p>
                        <div style={{
                            backgroundColor: '#1e1e1e',
                            padding: '8px',
                            marginTop: '6px',
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            border: '1px solid #444',
                            borderRadius: '3px'
                        }}>
                            $ ./program<br />
                            {instructions.step2Example}<br />
                            <span style={{ color: '#CE9178' }}>{instructions.step3Example}</span> {instructions.step3ExampleLabel}
                        </div>
                    </div>
                </div>

                {/* Step 4 */}
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{
                        backgroundColor: 'var(--theia-focusBorder)',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '10px',
                        flexShrink: 0
                    }}>4</div>
                    <div style={{ flexGrow: 1 }}>
                        <strong>{instructions.step4}</strong>
                        <p style={{ fontSize: '12px', opacity: 0.8, margin: '4px 0 0 0' }}>
                            {instructions.step4Desc}
                        </p>
                        <div style={{
                            backgroundColor: '#1e1e1e',
                            padding: '8px',
                            marginTop: '6px',
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            border: '1px solid #444',
                            borderRadius: '3px'
                        }}>
                            {instructions.step4Example}<span style={{ color: '#4EC9B0' }}>{instructions.step4ExampleValue}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Warning box */}
            <div style={{
                backgroundColor: 'rgba(255, 193, 7, 0.1)',
                border: '1px solid rgba(255, 193, 7, 0.5)',
                padding: '12px',
                marginBottom: '15px',
                borderRadius: '4px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <i className="fa fa-exclamation-triangle" style={{ color: '#FFC107', marginRight: '8px' }}></i>
                    <strong style={{ color: '#FFC107' }}>{instructions.mistakesTitle}</strong>
                </div>
                <ul style={{ fontSize: '12px', margin: '0', paddingLeft: '20px', lineHeight: '1.6' }}>
                    <li>{instructions.mistake1}</li>
                    <li>{instructions.mistake2}</li>
                    <li>{instructions.mistake3}</li>
                    <li>{instructions.mistake4}</li>
                </ul>
            </div>

            {/* Checkbox and buttons */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                <input
                    type="checkbox"
                    id="dont-show-again"
                    style={{ marginRight: '8px' }}
                />
                <label htmlFor="dont-show-again" style={{ fontSize: '12px', cursor: 'pointer' }}>
                    {instructions.dontShowAgain}
                </label>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
                <button
                    className="theia-button"
                    onClick={() => this.clearResponse()}
                >
                    {t(this.language, 'cancel')}
                </button>
                <button
                    className="theia-button primary"
                    onClick={() => {
                        const checkbox = document.getElementById('dont-show-again') as HTMLInputElement;
                        if (checkbox?.checked) {
                            localStorage.setItem(this.INSTRUCTIONS_DISMISSED_KEY, 'true');
                            this.showInstructions = false;
                        }
                        this.outputWrongStep = 2;
                        this.update();
                    }}
                >
                    {instructions.iUnderstand}
                </button>
            </div>
        </div>;
    }

    private renderOutputWrongInputForm(): React.ReactNode {
        return <div style={{ padding: '15px' }}>
            <h4 style={{ marginBottom: '10px' }}>{t(this.language, 'step1Title')}</h4>
            <p style={{ marginBottom: '10px', fontSize: '12px' }}>
                {t(this.language, 'step1InputPrompt')}
            </p>
            <textarea
                value={this.userInput}
                onChange={(e) => { this.userInput = e.target.value; this.update(); }}
                style={{
                    width: '100%',
                    minHeight: '80px',
                    marginBottom: '15px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                }}
                placeholder={t(this.language, 'step1InputPlaceholder')}
            />

            <p style={{ marginBottom: '10px', fontSize: '12px' }}>
                {t(this.language, 'step1OutputPrompt')}
            </p>
            <textarea
                value={this.programOutput}
                onChange={(e) => { this.programOutput = e.target.value; this.update(); }}
                style={{
                    width: '100%',
                    minHeight: '120px',
                    marginBottom: '15px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                }}
                placeholder={t(this.language, 'step1OutputPlaceholder')}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
                <button
                    className="theia-button"
                    onClick={() => this.clearResponse()}
                >
                    {t(this.language, 'cancel')}
                </button>
                <button
                    className="theia-button"
                    onClick={() => { this.outputWrongStep = 3; this.update(); }}
                    disabled={!this.programOutput}
                >
                    {t(this.language, 'continue')}
                </button>
            </div>
        </div>;
    }

    private renderOutputWrongExpectedForm(): React.ReactNode {
        return <div style={{ padding: '15px' }}>
            <h4 style={{ marginBottom: '10px' }}>{t(this.language, 'step2Title')}</h4>
            <p style={{ marginBottom: '10px', fontSize: '12px' }}>
                {t(this.language, 'step2Prompt')}
            </p>
            <textarea
                value={this.expectedOutput}
                onChange={(e) => { this.expectedOutput = e.target.value; this.update(); }}
                style={{
                    width: '100%',
                    minHeight: '150px',
                    marginBottom: '15px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                }}
                placeholder={t(this.language, 'step2Placeholder')}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
                <button
                    className="theia-button"
                    onClick={() => { this.outputWrongStep = 2; this.update(); }}
                >
                    {t(this.language, 'back')}
                </button>
                <button
                    className="theia-button"
                    onClick={() => this.submitOutputWrongRequest()}
                    disabled={!this.expectedOutput}
                >
                    {t(this.language, 'getHelp')}
                </button>
            </div>
        </div>;
    }

    private renderResponseTypeSelector(): React.ReactNode {
        const options: Array<{ type: ResponseType; icon: string; labelKey: keyof Translations; descKey: keyof Translations }> = [
            { type: 'hint', icon: 'fa-lightbulb-o', labelKey: 'responseTypeHint', descKey: 'responseTypeHintDesc' },
            { type: 'book', icon: 'fa-book', labelKey: 'responseTypeBook', descKey: 'responseTypeBookDesc' },
            { type: 'practice', icon: 'fa-graduation-cap', labelKey: 'responseTypePractice', descKey: 'responseTypePracticeDesc' },
        ];

        return <div style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '10px' }}>{t(this.language, 'responseTypeTitle')}</h3>
            <p style={{ marginBottom: '15px', fontSize: '13px', opacity: 0.8 }}>
                {t(this.language, 'responseTypeQuestion')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                {options.map(option => (
                    <button
                        key={option.type}
                        className="theia-button secondary"
                        onClick={() => this.chooseResponseType(option.type)}
                        style={{ display: 'flex', alignItems: 'flex-start', textAlign: 'left', padding: '10px 15px' }}
                    >
                        <i className={`fa ${option.icon}`} style={{ fontSize: '18px', marginRight: '10px', marginTop: '2px' }}></i>
                        <span>
                            <strong>{t(this.language, option.labelKey)}</strong>
                            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>
                                {t(this.language, option.descKey)}
                            </div>
                        </span>
                    </button>
                ))}
            </div>

            <button
                className="theia-button"
                onClick={() => this.clearResponse()}
            >
                {t(this.language, 'cancel')}
            </button>
        </div>;
    }

    private renderCrashWarning(): React.ReactNode {
        return <div style={{ padding: '20px' }}>
            <div style={{
                backgroundColor: 'rgba(255, 193, 7, 0.15)',
                border: '2px solid #FFC107',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '20px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                    <i className="fa fa-exclamation-triangle" style={{
                        fontSize: '32px',
                        color: '#FFC107',
                        marginRight: '15px'
                    }}></i>
                    <h3 style={{
                        margin: 0,
                        color: '#FFC107',
                        fontSize: '18px'
                    }}>
                        {t(this.language, 'crashWarningTitle')}
                    </h3>
                </div>

                <p style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    marginBottom: '0',
                    whiteSpace: 'pre-wrap'
                }}>
                    {t(this.language, 'crashWarningMessage')}
                </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                    className="theia-button"
                    onClick={() => this.clearResponse()}
                    style={{ minWidth: '120px' }}
                >
                    {t(this.language, 'cancel')}
                </button>
                <button
                    className="theia-button secondary"
                    onClick={() => this.proceedWithCrashAnalysis()}
                    style={{ minWidth: '120px' }}
                >
                    {t(this.language, 'proceedAnyway')}
                </button>
            </div>
        </div>;
    }

    private async proceedWithCrashAnalysis() {
        // Guard against double-clicks
        if (this.isProcessing) {
            console.log('AI Assistant: Ignoring proceed click - already processing');
            return;
        }

        this.showCrashWarning = false;
        const relativePath = this.crashPath;
        const code = this.crashCode;
        const task = this.crashTask;
        this.crashCode = '';
        this.crashPath = '';
        this.crashTask = '';

        // Call API with empty asan output (guessing mode)
        await this.submitCrashRequest('crash', relativePath, code, '', task);
    }

    private renderGenericWarning(titleKey: keyof Translations, messageKey: keyof Translations, onProceed: () => void): React.ReactNode {
        return <div style={{ padding: '20px' }}>
            <div style={{
                backgroundColor: 'rgba(255, 193, 7, 0.15)',
                border: '2px solid #FFC107',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '20px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                    <i className="fa fa-exclamation-triangle" style={{
                        fontSize: '32px',
                        color: '#FFC107',
                        marginRight: '15px'
                    }}></i>
                    <h3 style={{
                        margin: 0,
                        color: '#FFC107',
                        fontSize: '18px'
                    }}>
                        {t(this.language, titleKey)}
                    </h3>
                </div>

                <p style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    marginBottom: '0',
                    whiteSpace: 'pre-wrap'
                }}>
                    {t(this.language, messageKey)}
                </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                    className="theia-button"
                    onClick={() => this.clearResponse()}
                    style={{ minWidth: '120px' }}
                >
                    {t(this.language, 'cancel')}
                </button>
                <button
                    className="theia-button secondary"
                    onClick={onProceed}
                    style={{ minWidth: '120px' }}
                >
                    {t(this.language, 'proceedAnyway')}
                </button>
            </div>
        </div>;
    }

    private async proceedWithWhitespaceWarning() {
        this.showWhitespaceWarning = false;
        await this.submitOutputWrongRequest('output_whitespace');
    }

    private async proceedWithCompileWarnWarning() {
        // Guard against double-clicks
        if (this.isProcessing) {
            console.log('AI Assistant: Ignoring proceed click - already processing');
            return;
        }
        this.showCompileWarnWarning = false;
        // Re-fetch files and proceed
        const context = this.warningContext;
        if (context.relativePath && context.code && context.gccOutput) {
            await this.submitCompileRequest('compile_warn', context.relativePath, context.code, context.gccOutput, context.task);
        }
    }

    private async proceedWithStaleGccWarning() {
        // Guard against double-clicks
        if (this.isProcessing) {
            console.log('AI Assistant: Ignoring proceed click - already processing');
            return;
        }
        this.showStaleGccWarning = false;
        // Re-fetch both files
        const context = this.warningContext;
        if (!context.fileUri || !context.gccOutUri || !context.relativePath) {
            this.errorMessage = 'Missing file information in warning context';
            this.update();
            return;
        }
        try {
            const fileContent = await this.fileService.read(context.fileUri);
            const gccOutContent = await this.fileService.read(context.gccOutUri);
            await this.submitCompileRequest('compile', context.relativePath, fileContent.value, gccOutContent.value, context.task);
        } catch (error) {
            this.errorMessage = `Error re-reading files: ${error}`;
            this.update();
        }
    }

    private async proceedWithStaleAsanWarning() {
        // Guard against double-clicks
        if (this.isProcessing) {
            console.log('AI Assistant: Ignoring proceed click - already processing');
            return;
        }
        this.showStaleAsanWarning = false;
        // Re-fetch both files
        const context = this.warningContext;
        if (!context.fileUri || !context.asanOutUri || !context.relativePath) {
            this.errorMessage = 'Missing file information in warning context';
            this.update();
            return;
        }
        try {
            const fileContent = await this.fileService.read(context.fileUri);
            const asanOutContent = await this.fileService.read(context.asanOutUri);
            await this.submitCrashRequest('crash', context.relativePath, fileContent.value, asanOutContent.value, context.task);
        } catch (error) {
            this.errorMessage = `Error re-reading files: ${error}`;
            this.update();
        }
    }

    private renderFeedbackButtons(): React.ReactNode {
        // If feedback already given, show thank you message
        if (this.showFeedbackThankYou) {
            return <div style={{
                marginTop: '20px',
                padding: '15px',
                backgroundColor: 'rgba(76, 175, 80, 0.15)',
                border: '1px solid rgba(76, 175, 80, 0.3)',
                borderRadius: '6px',
                textAlign: 'center'
            }}>
                <i className="fa fa-check-circle" style={{
                    fontSize: '24px',
                    color: '#4CAF50',
                    marginRight: '10px'
                }}></i>
                <span style={{ fontSize: '14px', color: '#4CAF50' }}>
                    {t(this.language, 'feedbackThankYou')}
                </span>
            </div>;
        }

        // If feedback not yet given, show feedback buttons
        if (!this.feedbackGiven) {
            return <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--theia-panel-border)' }}>
                <p style={{ fontSize: '14px', marginBottom: '15px', fontWeight: 'bold' }}>
                    {t(this.language, 'feedbackQuestion')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                        className="theia-button secondary"
                        onClick={() => this.submitFeedback('helpful')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '10px 15px' }}
                    >
                        <span style={{ fontSize: '20px', marginRight: '10px' }}>👍</span>
                        <span>{t(this.language, 'feedbackHelpful')}</span>
                    </button>
                    <button
                        className="theia-button secondary"
                        onClick={() => this.submitFeedback('not-helpful')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '10px 15px' }}
                    >
                        <span style={{ fontSize: '20px', marginRight: '10px' }}>👎</span>
                        <span>{t(this.language, 'feedbackNotHelpful')}</span>
                    </button>
                    <button
                        className="theia-button secondary"
                        onClick={() => this.submitFeedback('confusing')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '10px 15px' }}
                    >
                        <span style={{ fontSize: '20px', marginRight: '10px' }}>❓</span>
                        <span>{t(this.language, 'feedbackConfusing')}</span>
                    </button>
                </div>
            </div>;
        }

        return null;
    }

    private async submitFeedback(feedback: string) {
        // Guard against double-clicks
        if (this.isProcessingFeedback) {
            console.log('AI Assistant: Ignoring feedback click - already processing');
            return;
        }

        console.log(`AI Assistant: User feedback - ${feedback}`);

        // Show processing state
        this.isProcessingFeedback = true;
        this.clearTypingState(); // Stop any ongoing typing and clear queue
        this.aiResponse = ''; // Clear previous response for typing effect
        this.update();

        // Get current file path
        const editorWidget = this.editorManager.currentEditor;
        const fileUri = editorWidget?.getResourceUri();
        const relativePath = fileUri ? this.getRelativePath(fileUri) : '';

        // Call API with typing effect callback
        const result = await this.aiService.submitFeedback(relativePath, feedback, this.handlePartialResponse);

        // Clear processing state
        this.isProcessingFeedback = false;

        if (result.error) {
            console.log("Feedback error: " + result.error);
            this.feedbackGiven = true;
            this.showFeedbackThankYou = true;
            this.isProfessorResponse = false;
        } else {
            console.log('Feedback submitted successfully');

            // If API returned an improved response (>20 chars), replace the AI response
            if (result.data && result.data.length > 20) {
                this.flushTypingQueue(); // Flush any remaining characters in typing queue
                this.aiResponse = result.data; // Set final complete response
                // Feedback was already given for this exchange - show thank you, not another prompt
                this.feedbackGiven = true;
                this.showFeedbackThankYou = true;
                this.isProfessorResponse = true; // Mark as professor response
            } else {
                // Short response or no data - just show thank you
                this.feedbackGiven = true;
                this.showFeedbackThankYou = true;
                this.isProfessorResponse = false;
            }
        }

        this.update();
    }

    private async handleHelpButtonClick(topicId: string) {
        // Guard against double-clicks - check synchronously before any async operation
        if (this.isProcessing) {
            console.log('AI Assistant: Ignoring click - already processing');
            return;
        }

        console.log(`AI Assistant: User needs help with - ${topicId}`);

        if (topicId === 'compile-error') {
            await this.handleCompileError();
        } else if (topicId === 'wrong-output') {
            await this.handleOutputWrong();
        } else if (topicId === 'crashing') {
            await this.handleProgramCrash();
        } else if (topicId === 'tests-failing') {
            await this.handleTestsFailing();
        } else {
            // Unknown topic ID
            this.errorMessage = 'This feature is not yet implemented.';
            this.update();
        }
    }

    private async handleOutputWrong() {
        try {
            // Step 1: Get current editor
            const editorWidget = this.editorManager.currentEditor;
            if (!editorWidget) {
                this.errorMessage = t(this.language, 'noFileOpen');
                this.update();
                return;
            }

            // Step 2: Get file path and read contents
            const fileUri = editorWidget.getResourceUri();
            if (!fileUri) {
                this.errorMessage = t(this.language, 'noFilePath');
                this.update();
                return;
            }

            this.currentPath = this.getRelativePath(fileUri);
            const fileContent = await this.fileService.read(fileUri);
            this.currentCode = fileContent.value;

            // Step 2.5: Read task specification if available
            this.currentTask = await this.getTaskSpecification(fileUri);

            // Step 3: Try to get terminal output (attempt to find run task terminal)
            // Need to get the workspace-relative path for terminal title matching
            const workspaceRoot = this.workspaceService.workspace?.resource;
            const fileUriString = fileUri.toString();
            const workspaceRelativePath = workspaceRoot
                ? fileUriString.slice(workspaceRoot.toString().length)
                : fileUriString;

            const terminalOutput = await this.tryGetTerminalOutput(workspaceRelativePath);
            if (terminalOutput) {
                this.programOutput = terminalOutput;
            }

            // Show instructions if needed, otherwise go directly to input form
            if (this.showInstructions) {
                this.outputWrongStep = 1; // Show instructions
            } else {
                this.outputWrongStep = 2; // Skip to input form
            }
            this.update();

        } catch (error) {
            console.error('AI Assistant: Error in handleOutputWrong', error);
            this.errorMessage = `Unexpected error: ${error}`;
            this.update();
        }
    }

    private async tryGetTerminalOutput(filePath: string): Promise<string | null> {
        try {
            // Construct the exact terminal title: "Task: Run /path/to/file.c"
            const exactTitle = `Task: Run ${filePath}`;
            console.log(`AI Assistant: Looking for terminal with exact title: "${exactTitle}"`);

            const terminals = this.terminalService.all;
            console.log(`AI Assistant: Found ${terminals.length} terminal(s) total`);

            // First pass: Try exact match
            for (const terminal of terminals) {
                const title = terminal.title.label;
                console.log(`AI Assistant: Checking terminal: "${title}"`);
                if (title === exactTitle) {
                    console.log('AI Assistant: ✓ Found exact match terminal:', title);
                    const output = this.extractTerminalOutput(terminal);
                    if (output !== null) {
                        return output;
                    }
                }
            }

            console.log('AI Assistant: No exact match found, trying partial match...');

            // Second pass: Fallback to partial match if exact match not found
            for (const terminal of terminals) {
                const title = terminal.title.label.toLowerCase();
                if (title.includes('run') || title.includes('task')) {
                    console.log('AI Assistant: Found partial match terminal:', terminal.title.label);
                    const output = this.extractTerminalOutput(terminal);
                    if (output !== null) {
                        return output;
                    }
                }
            }

            console.log('AI Assistant: No run terminal found');
            return null;
        } catch (error) {
            console.warn('AI Assistant: Could not access terminal output:', error);
            return null;
        }
    }

    private extractTerminalOutput(terminal: any): string | null {
        try {
            // Use the terminal buffer API to get output
            const buffer = terminal.buffer;
            if (!buffer) {
                console.warn('AI Assistant: Terminal has no buffer');
                return null;
            }

            const lineCount = buffer.length;
            if (lineCount === 0) {
                console.log('AI Assistant: Terminal buffer is empty');
                return null;
            }

            // Get last 100 lines (or all if fewer)
            const linesToRead = Math.min(100, lineCount);
            const startLine = Math.max(0, lineCount - linesToRead);
            const lines = buffer.getLines(startLine, linesToRead);

            // Reverse the lines to fix the reversed order issue
            lines.reverse();

            // Join lines and strip ANSI escape codes
            const output = lines.join('\n');
            const cleanedOutput = this.aiService.stripAnsiCodes(output);

            console.log(`AI Assistant: Retrieved ${lines.length} lines from terminal buffer (reversed)`);
            return cleanedOutput;
        } catch (error) {
            console.warn('AI Assistant: Error extracting terminal output:', error);
            return null;
        }
    }

    private async submitOutputWrongRequest(action: string = 'output') {
        // Guard against double-clicks
        if (this.isProcessing) {
            console.log('AI Assistant: Ignoring submit click - already processing');
            return;
        }

        // Validation
        const validation = this.aiService.validateOutputInputs(
            this.programOutput,
            this.expectedOutput
        );

        if (!validation.valid) {
            if (validation.errorMessage) {
                this.errorMessage = t(this.language, validation.errorMessage as keyof Translations);
                this.outputWrongStep = 3;
            } else if (validation.showWarning === 'whitespace') {
                this.showWhitespaceWarning = true;
                this.outputWrongStep = 0;
            }
            this.update();
            return;
        }

        this.outputWrongStep = 0;
        await this.gateResponseType(responseType => this.executeOutputWrongRequest(action, responseType));
    }

    private async executeOutputWrongRequest(action: string, responseType?: ResponseType) {
        try {
            this.isProcessing = true;
            this.errorMessage = '';
            this.clearTypingState();
            this.aiResponse = '';
            this.isProfessorResponse = false;
            this.feedbackGiven = false;
            this.showFeedbackThankYou = false;
            this.isProcessingFeedback = false;
            this.update();

            const result = await this.aiService.submitOutputRequest(
                action as 'output' | 'output_whitespace',
                this.currentPath,
                this.currentCode,
                this.userInput,
                this.programOutput,
                this.expectedOutput,
                this.currentTask,
                responseType,
                this.handlePartialResponse
            );

            if (result.error) {
                if (result.error === 'QUOTA_EXCEEDED') {
                    this.quotaExceeded = true;
                } else {
                    this.errorMessage = result.error;
                }
            } else {
                this.flushTypingQueue();
                this.aiResponse = result.data || '';
            }
        } catch (error) {
            console.error('AI Assistant: Error submitting output wrong request', error);
            this.errorMessage = `Unexpected error: ${error}`;
        } finally {
            this.isProcessing = false;
            this.update();
        }
    }

    private async submitCompileRequest(action: string, relativePath: string, code: string, gccOutput: string, task?: string) {
        // Note: no isProcessing guard here - callers (handleCompileError etc.) already set
        // isProcessing themselves and are responsible for their own double-click protection.
        await this.gateResponseType(responseType =>
            this.executeCompileRequest(action, relativePath, code, gccOutput, task, responseType)
        );
    }

    private async executeCompileRequest(action: string, relativePath: string, code: string, gccOutput: string, task?: string, responseType?: ResponseType) {
        try {
            this.isProcessing = true;
            this.errorMessage = '';
            this.clearTypingState();
            this.aiResponse = '';
            this.isProfessorResponse = false;
            this.feedbackGiven = false;
            this.showFeedbackThankYou = false;
            this.isProcessingFeedback = false;
            this.update();

            const result = await this.aiService.submitCompileRequest(
                action as 'compile' | 'compile_warn',
                relativePath,
                code,
                gccOutput,
                task,
                responseType,
                this.handlePartialResponse
            );

            if (result.error) {
                if (result.error === 'QUOTA_EXCEEDED') {
                    this.quotaExceeded = true;
                } else {
                    this.errorMessage = result.error;
                }
            } else {
                this.flushTypingQueue();
                this.aiResponse = result.data || '';
            }
        } catch (error) {
            console.error('AI Assistant: Error submitting compile request', error);
            this.errorMessage = `Unexpected error: ${error}`;
        } finally {
            this.isProcessing = false;
            this.update();
        }
    }

    private async submitCrashRequest(action: string, relativePath: string, code: string, asanOutput: string, task?: string) {
        // Note: no isProcessing guard here - callers (handleProgramCrash etc.) already set
        // isProcessing themselves and are responsible for their own double-click protection.
        await this.gateResponseType(responseType =>
            this.executeCrashRequest(relativePath, code, asanOutput, task, responseType)
        );
    }

    private async executeCrashRequest(relativePath: string, code: string, asanOutput: string, task?: string, responseType?: ResponseType) {
        try {
            this.isProcessing = true;
            this.errorMessage = '';
            this.clearTypingState();
            this.aiResponse = '';
            this.isProfessorResponse = false;
            this.feedbackGiven = false;
            this.showFeedbackThankYou = false;
            this.isProcessingFeedback = false;
            this.update();

            const result = await this.aiService.submitCrashRequest(
                'crash',
                relativePath,
                code,
                asanOutput,
                task,
                responseType,
                this.handlePartialResponse
            );

            if (result.error) {
                if (result.error === 'QUOTA_EXCEEDED') {
                    this.quotaExceeded = true;
                } else {
                    this.errorMessage = result.error;
                }
            } else {
                this.flushTypingQueue();
                this.aiResponse = result.data || '';
            }
        } catch (error) {
            console.error('AI Assistant: Error submitting crash request', error);
            this.errorMessage = `Unexpected error: ${error}`;
        } finally {
            this.isProcessing = false;
            this.update();
        }
    }

    private async handleProgramCrash() {
        try {
            this.isProcessing = true;
            this.errorMessage = '';
            this.clearTypingState();
            this.aiResponse = '';
            this.isProfessorResponse = false;
            this.update();

            // Step 1: Get current editor
            const editorWidget = this.editorManager.currentEditor;
            if (!editorWidget) {
                this.errorMessage = t(this.language, 'noFileOpen');
                this.isProcessing = false;
                this.update();
                return;
            }

            // Step 2: Get file path and read contents
            const fileUri = editorWidget.getResourceUri();
            if (!fileUri) {
                this.errorMessage = t(this.language, 'noFilePath');
                this.isProcessing = false;
                this.update();
                return;
            }

            const relativePath = this.getRelativePath(fileUri);
            const fileContent = await this.fileService.read(fileUri);
            const code = fileContent.value;

            // Step 2.5: Read task specification if available
            const task = await this.getTaskSpecification(fileUri);

            // Step 3: Try to read .asan.out file from same directory
            const fileDir = fileUri.parent;
            const asanOutUri = new URI(fileDir.toString() + '/.asan.out');

            let asanOutput: string = '';
            let asanFileFound = false;
            try {
                const asanOutContent = await this.fileService.read(asanOutUri);
                asanOutput = asanOutContent.value.trim();
                asanFileFound = true;
                console.log('AI Assistant: Found .asan.out file');
            } catch (error) {
                console.log('AI Assistant: No .asan.out file found');
            }

            // Step 4: Check if .asan.out is missing or empty - show warning
            if (!asanFileFound || asanOutput === '') {
                console.log('AI Assistant: .asan.out missing or empty, showing warning');
                this.showCrashWarning = true;
                this.crashCode = code;
                this.crashPath = relativePath;
                this.crashTask = task;
                this.isProcessing = false;
                this.update();
                return;
            }

            // Step 5: Validate crash inputs (timestamp check)
            const validation = await this.aiService.validateCrashInputs(
                fileUri,
                asanOutUri,
                asanOutput,
                asanFileFound
            );

            if (!validation.valid && validation.showWarning === 'stale-asan') {
                this.warningContext = { ...validation.context, relativePath, code, asanOutput, task };
                this.showStaleAsanWarning = true;
                this.isProcessing = false;
                this.update();
                return;
            }

            // Step 6: .asan.out exists, has content, and is fresh - proceed with analysis
            await this.submitCrashRequest('crash', relativePath, code, asanOutput, task);

        } catch (error) {
            console.error('AI Assistant: Error handling program crash', error);
            this.errorMessage = `Unexpected error: ${error}`;
        } finally {
            this.isProcessing = false;
            this.update();
        }
    }

    private async handleTestsFailing() {
        try {
            this.isProcessing = true;
            this.errorMessage = '';
            this.clearTypingState();
            this.aiResponse = '';
            this.isProfessorResponse = false;
            this.update();

            // Step 1: Get current editor
            const editorWidget = this.editorManager.currentEditor;
            if (!editorWidget) {
                this.errorMessage = t(this.language, 'noFileOpen');
                this.isProcessing = false;
                this.update();
                return;
            }

            // Step 2: Get file path and read contents
            const fileUri = editorWidget.getResourceUri();
            if (!fileUri) {
                this.errorMessage = t(this.language, 'noFilePath');
                this.isProcessing = false;
                this.update();
                return;
            }

            const relativePath = this.getRelativePath(fileUri);
            const fileContent = await this.fileService.read(fileUri);
            const code = fileContent.value;

            // Step 2.5: Read task specification if available
            const task = await this.getTaskSpecification(fileUri);

            // Step 3: Read .autotest3 file
            const fileDir = fileUri.parent;
            const autotestUri = new URI(fileDir.toString() + '/.autotest3');

            let autotestContent: string;
            try {
                const autotestFile = await this.fileService.read(autotestUri);
                autotestContent = autotestFile.value;
            } catch (error) {
                this.errorMessage = t(this.language, 'testsNotFound');
                this.isProcessing = false;
                this.update();
                return;
            }

            // Step 4: Read .at_result file
            const atResultUri = new URI(fileDir.toString() + '/.at_result');

            let atResultContent: string;
            try {
                const atResultFile = await this.fileService.read(atResultUri);
                atResultContent = atResultFile.value;
            } catch (error) {
                this.errorMessage = t(this.language, 'testResultsNotFound');
                this.isProcessing = false;
                this.update();
                return;
            }

            // Step 5: Choose assistance type (V2) and call API
            await this.gateResponseType(responseType =>
                this.executeAutotestRequest(relativePath, code, autotestContent, atResultContent, task, responseType)
            );

        } catch (error) {
            console.error('AI Assistant: Error handling tests failing', error);
            this.errorMessage = `Unexpected error: ${error}`;
        } finally {
            this.isProcessing = false;
            this.update();
        }
    }

    private async executeAutotestRequest(relativePath: string, code: string, autotestContent: string, atResultContent: string, task: string | undefined, responseType?: ResponseType) {
        try {
            this.isProcessing = true;
            this.errorMessage = '';
            this.clearTypingState();
            this.aiResponse = '';
            this.isProfessorResponse = false;
            this.feedbackGiven = false;
            this.showFeedbackThankYou = false;
            this.isProcessingFeedback = false;
            this.update();

            const result = await this.aiService.submitAutotestRequest(
                relativePath,
                code,
                autotestContent,
                atResultContent,
                task,
                responseType,
                this.handlePartialResponse
            );

            if (result.error) {
                if (result.error === 'QUOTA_EXCEEDED') {
                    this.quotaExceeded = true;
                } else if (result.error === 'main function not found') {
                    this.errorMessage = t(this.language, 'mainNotFound');
                } else if (result.error === 'No failed test was found') {
                    this.errorMessage = t(this.language, 'noFailedTests');
                } else {
                    this.errorMessage = result.error;
                }
            } else {
                this.flushTypingQueue();
                this.aiResponse = result.data || '';
            }
        } catch (error) {
            console.error('AI Assistant: Error submitting autotest request', error);
            this.errorMessage = `Unexpected error: ${error}`;
        } finally {
            this.isProcessing = false;
            this.update();
        }
    }

    private async handleCompileError() {
        try {
            this.isProcessing = true;
            this.errorMessage = '';
            this.clearTypingState();
            this.aiResponse = '';
            this.isProfessorResponse = false;
            this.update();

            // Step 1: Get current editor
            const editorWidget = this.editorManager.currentEditor;
            if (!editorWidget) {
                this.errorMessage = t(this.language, 'noFileOpen');
                this.isProcessing = false;
                this.update();
                return;
            }

            // Step 2: Get file path
            const fileUri = editorWidget.getResourceUri();
            if (!fileUri) {
                this.errorMessage = t(this.language, 'noFilePath');
                this.isProcessing = false;
                this.update();
                return;
            }

            // Get workspace root
            const workspaceRoot = this.workspaceService.workspace?.resource;
            if (!workspaceRoot) {
                this.errorMessage = 'No workspace is open.';
                this.isProcessing = false;
                this.update();
                return;
            }

            // Calculate relative path
            const relativePath = this.getRelativePath(fileUri);

            // Step 3: Read file contents
            const fileContent = await this.fileService.read(fileUri);
            const code = fileContent.value;

            // Step 3.5: Read task specification if available
            const task = await this.getTaskSpecification(fileUri);

            // Step 4: Read .gcc.out file
            const fileDir = fileUri.parent;
            const gccOutUri = new URI(fileDir.toString() + '/.gcc.out');

            let gccOutput: string;
            let gccFileExists = false;
            try {
                const gccOutContent = await this.fileService.read(gccOutUri);
                gccOutput = gccOutContent.value;
                gccFileExists = true;
            } catch (error) {
                gccOutput = '';
            }

            // Validate compile inputs
            const validation = await this.aiService.validateCompileInputs(
                fileUri,
                gccOutUri,
                gccOutput,
                gccFileExists
            );

            if (!validation.valid) {
                if (validation.errorMessage) {
                    this.errorMessage = t(this.language, validation.errorMessage as keyof Translations);
                } else if (validation.showWarning === 'compile-warn') {
                    this.warningContext = { relativePath, code, gccOutput, task };
                    this.showCompileWarnWarning = true;
                } else if (validation.showWarning === 'stale-gcc') {
                    this.warningContext = { ...validation.context, relativePath, code, gccOutput, task };
                    this.showStaleGccWarning = true;
                }
                this.isProcessing = false;
                this.update();
                return;
            }

            // All checks passed, proceed with compilation error analysis
            await this.submitCompileRequest('compile', relativePath, code, gccOutput, task);

        } catch (error) {
            console.error('AI Assistant: Error handling compile error', error);
            this.errorMessage = `Unexpected error: ${error}`;
            this.isProcessing = false;
            this.update();
        }
    }
}
