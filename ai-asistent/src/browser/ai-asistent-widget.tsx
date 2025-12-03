import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { EditorManager } from '@theia/editor/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import URI from '@theia/core/lib/common/uri';
import { comingSoonImage, friendlyAssistantImage, tiredAssistantImage } from './encoded-images';
import MarkdownIt = require('markdown-it');

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

    private isAvailable: boolean = false;
    private isChecking: boolean = true;
    private aiResponse: string = '';
    private errorMessage: string = '';
    private isProcessing: boolean = false;
    private quotaExceeded: boolean = false;

    // Markdown renderer for AI responses
    private readonly markdownRenderer: MarkdownIt;

    // Multi-step form state for "Program output is wrong"
    private outputWrongStep: number = 0; // 0=not started, 1=input form, 2=expected output form
    private currentCode: string = '';
    private currentPath: string = '';
    private userInput: string = '';
    private programOutput: string = '';
    private expectedOutput: string = '';

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

    @postConstruct()
    protected async init(): Promise<void> {
        this.id = AiAsistentWidget.ID;
        this.title.label = AiAsistentWidget.LABEL;
        this.title.caption = AiAsistentWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-lightbulb-o';

        // Check if AI assistant is available
        await this.checkAvailability();

        this.update();
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
                    Daily AI Request Quota Exceeded
                </h2>
                <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--theia-foreground)', opacity: 0.8 }}>
                    You have reached your daily limit for AI assistant requests.
                    <br/>
                    You will be able to ask your next question tomorrow or next week,
                    <br/>
                    according to the rules set by your course teacher.
                </p>
                <button
                    className="theia-button"
                    onClick={() => this.clearResponse()}
                    style={{ marginTop: '20px' }}
                >
                    Back
                </button>
            </div>;
        }

        // Show normal AI assistant interface if available
        return <div id='ai-assistant-container'>
            {!this.isProcessing && !this.aiResponse && !this.errorMessage && this.outputWrongStep === 0 && (
                <>
                    <div className='ai-assistant-greeting' style={{ textAlign: 'center' }}>
                        <img
                            src={friendlyAssistantImage}
                            alt="AI Teaching Assistant"
                            style={{ maxWidth: '100%', height: 'auto', marginBottom: '10px' }}
                        />
                        <h3>Hello, I'm your AI teaching assistant!</h3>
                        <p>What can I help you with?</p>
                    </div>

                    <div className='ai-assistant-buttons'>
                        {this.renderHelpButton('Code doesn\'t compile', 'fa fa-exclamation-triangle')}
                        {this.renderHelpButton('Program output is wrong', 'fa fa-bug')}
                        {this.renderHelpButton('Program is crashing', 'fa fa-bomb')}
                        {this.renderHelpButton('Tests are failing', 'fa fa-times-circle')}
                    </div>
                </>
            )}

            {!this.isProcessing && this.outputWrongStep === 1 && this.renderOutputWrongInputForm()}
            {!this.isProcessing && this.outputWrongStep === 2 && this.renderOutputWrongExpectedForm()}

            {this.isProcessing && (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="ai-spinner"></div>
                    <p className="ai-spinner-text">Processing your request...</p>
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
                    <h4 style={{ color: '#f44336', marginBottom: '10px' }}>Error</h4>
                    <p style={{ color: '#d32f2f' }}>{this.errorMessage}</p>
                    <button
                        className="theia-button"
                        onClick={() => this.clearResponse()}
                        style={{ marginTop: '10px' }}
                    >
                        Back
                    </button>
                </div>
            )}

            {this.aiResponse && (
                <div style={{ padding: '15px' }}>
                    <h4 style={{ marginBottom: '10px' }}>AI Response</h4>
                    <div
                        className="ai-response-content"
                        dangerouslySetInnerHTML={{ __html: this.markdownRenderer.render(this.aiResponse) }}
                    />
                    <button
                        className="theia-button"
                        onClick={() => this.clearResponse()}
                        style={{ marginTop: '15px' }}
                    >
                        Back
                    </button>
                </div>
            )}
        </div>
    }

    private renderHelpButton(text: string, iconClass: string): React.ReactNode {
        return <button
            className="theia-button ai-help-button"
            onClick={() => this.handleHelpButtonClick(text)}
        >
            <i className={`button-icon ${iconClass}`} aria-hidden="true"></i>
            <span>{text}</span>
        </button>
    }

    private clearResponse() {
        this.aiResponse = '';
        this.errorMessage = '';
        this.quotaExceeded = false;
        this.outputWrongStep = 0;
        this.currentCode = '';
        this.currentPath = '';
        this.userInput = '';
        this.programOutput = '';
        this.expectedOutput = '';
        this.update();
    }

    private async handleApiError(response: Response): Promise<void> {
        // Handle common API errors with friendly messages
        if (response.status === 400) {
            try {
                const errorData = await response.json().catch(() => ({}));
                if (errorData.message && errorData.message.toLowerCase().includes('too many requests')) {
                    this.quotaExceeded = true;
                    return;
                }
                this.errorMessage = errorData.message || 'Bad request. Please try again.';
            } catch (e) {
                this.errorMessage = 'Bad request. Please try again.';
            }
        } else if (response.status === 401) {
            this.errorMessage = 'You are not authorized to use the AI assistant. Please check with your course instructor.';
        } else if (response.status === 403) {
            this.errorMessage = 'Access forbidden. Please check with your course instructor.';
        } else if (response.status === 429) {
            // Rate limit exceeded
            this.quotaExceeded = true;
        } else if (response.status >= 500) {
            this.errorMessage = 'The AI service is temporarily unavailable. Please try again later.';
        } else {
            const errorData = await response.json().catch(() => ({}));
            this.errorMessage = errorData.message || `API error: ${response.status}`;
        }
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

    private renderOutputWrongInputForm(): React.ReactNode {
        return <div style={{ padding: '15px' }}>
            <h4 style={{ marginBottom: '10px' }}>Step 1: Input and Output</h4>
            <p style={{ marginBottom: '10px', fontSize: '12px' }}>
                Enter the input values your program received (or leave empty if none):
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
                placeholder="Enter input values..."
            />

            <p style={{ marginBottom: '10px', fontSize: '12px' }}>
                Copy and paste your program's output here:
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
                placeholder="Paste program output..."
            />

            <div style={{ display: 'flex', gap: '10px' }}>
                <button
                    className="theia-button"
                    onClick={() => this.clearResponse()}
                >
                    Cancel
                </button>
                <button
                    className="theia-button"
                    onClick={() => { this.outputWrongStep = 2; this.update(); }}
                    disabled={!this.programOutput}
                >
                    Continue
                </button>
            </div>
        </div>;
    }

    private renderOutputWrongExpectedForm(): React.ReactNode {
        return <div style={{ padding: '15px' }}>
            <h4 style={{ marginBottom: '10px' }}>Step 2: Expected Output</h4>
            <p style={{ marginBottom: '10px', fontSize: '12px' }}>
                Enter or paste the expected output for your program:
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
                placeholder="Enter expected output..."
            />

            <div style={{ display: 'flex', gap: '10px' }}>
                <button
                    className="theia-button"
                    onClick={() => { this.outputWrongStep = 1; this.update(); }}
                >
                    Back
                </button>
                <button
                    className="theia-button"
                    onClick={() => this.submitOutputWrongRequest()}
                    disabled={!this.expectedOutput}
                >
                    Get AI Help
                </button>
            </div>
        </div>;
    }

    private async handleHelpButtonClick(topic: string) {
        console.log(`AI Assistant: User needs help with - ${topic}`);

        if (topic === 'Code doesn\'t compile') {
            await this.handleCompileError();
        } else if (topic === 'Program output is wrong') {
            await this.handleOutputWrong();
        } else if (topic === 'Program is crashing') {
            await this.handleProgramCrash();
        } else if (topic === 'Tests are failing') {
            await this.handleTestsFailing();
        } else {
            // TODO: Implement other topics
            this.errorMessage = 'This feature is not yet implemented.';
            this.update();
        }
    }

    private async handleOutputWrong() {
        try {
            // Step 1: Get current editor
            const editorWidget = this.editorManager.currentEditor;
            if (!editorWidget) {
                this.errorMessage = 'No file is currently opened in the editor.';
                this.update();
                return;
            }

            // Step 2: Get file path and read contents
            const fileUri = editorWidget.getResourceUri();
            if (!fileUri) {
                this.errorMessage = 'Could not determine the file path.';
                this.update();
                return;
            }

            this.currentPath = this.getRelativePath(fileUri);
            const fileContent = await this.fileService.read(fileUri);
            this.currentCode = fileContent.value;

            // Step 3: Try to get terminal output (attempt to find run task terminal)
            const terminalOutput = await this.tryGetTerminalOutput();
            if (terminalOutput) {
                this.programOutput = terminalOutput;
            }

            // Show the input form
            this.outputWrongStep = 1;
            this.update();

        } catch (error) {
            console.error('AI Assistant: Error in handleOutputWrong', error);
            this.errorMessage = `Unexpected error: ${error}`;
            this.update();
        }
    }

    private async tryGetTerminalOutput(): Promise<string | null> {
        try {
            // Try to find terminal widget with "Run" in title
            const terminals = this.terminalService.all;
            for (const terminal of terminals) {
                const title = terminal.title.label.toLowerCase();
                if (title.includes('run') || title.includes('task')) {
                    // Terminal widgets don't have a direct API to get buffer content
                    // This would require accessing internal terminal implementation
                    // For now, we'll return null and let user paste manually
                    console.log('Found run terminal:', terminal.title.label);
                    return null;
                }
            }
            return null;
        } catch (error) {
            console.warn('Could not access terminal output:', error);
            return null;
        }
    }

    private async submitOutputWrongRequest() {
        try {
            this.isProcessing = true;
            this.outputWrongStep = 0;
            this.errorMessage = '';
            this.aiResponse = '';
            this.update();

            // Call API
            const formData = new FormData();
            formData.append('action', 'output');
            formData.append('path', this.currentPath);
            formData.append('code', this.currentCode);
            formData.append('input', this.userInput);
            formData.append('output', this.programOutput);
            formData.append('expected', this.expectedOutput);

            const response = await fetch('/api/v1/ai/asistent', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!response.ok) {
                await this.handleApiError(response);
                this.isProcessing = false;
                this.update();
                return;
            }

            const data = await response.json();

            if (data.data) {
                this.aiResponse = data.data;
            } else {
                this.errorMessage = 'API response did not contain expected data.';
            }

        } catch (error) {
            console.error('AI Assistant: Error submitting output wrong request', error);
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
            this.aiResponse = '';
            this.update();

            // Step 1: Get current editor
            const editorWidget = this.editorManager.currentEditor;
            if (!editorWidget) {
                this.errorMessage = 'No file is currently opened in the editor.';
                this.isProcessing = false;
                this.update();
                return;
            }

            // Step 2: Get file path and read contents
            const fileUri = editorWidget.getResourceUri();
            if (!fileUri) {
                this.errorMessage = 'Could not determine the file path.';
                this.isProcessing = false;
                this.update();
                return;
            }

            const relativePath = this.getRelativePath(fileUri);
            const fileContent = await this.fileService.read(fileUri);
            const code = fileContent.value;

            // Step 3: Try to read .asan.out file from same directory
            const fileDir = fileUri.parent;
            const asanOutUri = new URI(fileDir.toString() + '/.asan.out');

            let asanOutput: string = '';
            try {
                const asanOutContent = await this.fileService.read(asanOutUri);
                asanOutput = asanOutContent.value;
                console.log('AI Assistant: Found .asan.out file');
            } catch (error) {
                console.log('AI Assistant: No .asan.out file found, proceeding without it');
                // Continue with empty asan output
            }

            // Step 4: Call API
            const formData = new FormData();
            formData.append('action', 'crash');
            formData.append('path', relativePath);
            formData.append('code', code);
            formData.append('asan', asanOutput);

            const response = await fetch('/api/v1/ai/asistent', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!response.ok) {
                await this.handleApiError(response);
                this.isProcessing = false;
                this.update();
                return;
            }

            const data = await response.json();

            if (data.data) {
                this.aiResponse = data.data;
            } else {
                this.errorMessage = 'API response did not contain expected data.';
            }

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
            this.aiResponse = '';
            this.update();

            // Step 1: Get current editor
            const editorWidget = this.editorManager.currentEditor;
            if (!editorWidget) {
                this.errorMessage = 'No file is currently opened in the editor.';
                this.isProcessing = false;
                this.update();
                return;
            }

            // Step 2: Get file path and read contents
            const fileUri = editorWidget.getResourceUri();
            if (!fileUri) {
                this.errorMessage = 'Could not determine the file path.';
                this.isProcessing = false;
                this.update();
                return;
            }

            const relativePath = this.getRelativePath(fileUri);
            const fileContent = await this.fileService.read(fileUri);
            const code = fileContent.value;

            // Step 3: Read .autotest3 file
            const fileDir = fileUri.parent;
            const autotestUri = new URI(fileDir.toString() + '/.autotest3');

            let autotestContent: string;
            try {
                const autotestFile = await this.fileService.read(autotestUri);
                autotestContent = autotestFile.value;
            } catch (error) {
                this.errorMessage = 'Tests not found.';
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
                this.errorMessage = 'Test results not found, please retest the project and ask again.';
                this.isProcessing = false;
                this.update();
                return;
            }

            // Step 5: Call API
            const formData = new FormData();
            formData.append('action', 'autotest');
            formData.append('path', relativePath);
            formData.append('code', code);
            formData.append('autotest', autotestContent);
            formData.append('result', atResultContent);

            const response = await fetch('/api/v1/ai/asistent', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!response.ok) {
                await this.handleApiError(response);
                this.isProcessing = false;
                this.update();
                return;
            }

            const data = await response.json();

            // Handle special cases
            if (data.message === 'main function not found') {
                this.errorMessage = 'Testing function couldn\'t locate a main function. Please check if a nonstandard main declaration is used.';
                this.isProcessing = false;
                this.update();
                return;
            }

            if (data.message === 'No failed test was found') {
                this.errorMessage = 'All tests were successful - there\'s nothing to help with!';
                this.isProcessing = false;
                this.update();
                return;
            }

            if (data.data) {
                this.aiResponse = data.data;
            } else {
                this.errorMessage = 'API response did not contain expected data.';
            }

        } catch (error) {
            console.error('AI Assistant: Error handling tests failing', error);
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
            this.aiResponse = '';
            this.update();

            // Step 1: Get current editor
            const editorWidget = this.editorManager.currentEditor;
            if (!editorWidget) {
                this.errorMessage = 'No file is currently opened in the editor.';
                this.isProcessing = false;
                this.update();
                return;
            }

            // Step 2: Get file path
            const fileUri = editorWidget.getResourceUri();
            if (!fileUri) {
                this.errorMessage = 'Could not determine the file path.';
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

            // Step 4: Read .gcc.out file
            const fileDir = fileUri.parent;
            const gccOutUri = new URI(fileDir.toString() + '/.gcc.out');

            let gccOutput: string;
            try {
                const gccOutContent = await this.fileService.read(gccOutUri);
                gccOutput = gccOutContent.value;
            } catch (error) {
                this.errorMessage = 'No .gcc.out file found in the same directory as the current file.';
                this.isProcessing = false;
                this.update();
                return;
            }

            // Step 5: Call API
            const formData = new FormData();
            formData.append('action', 'compile');
            formData.append('path', relativePath);
            formData.append('code', code);
            formData.append('output', gccOutput);

            const response = await fetch('/api/v1/ai/asistent', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!response.ok) {
                await this.handleApiError(response);
                this.isProcessing = false;
                this.update();
                return;
            }

            const data = await response.json();

            if (data.data) {
                this.aiResponse = data.data;
            } else {
                this.errorMessage = 'API response did not contain expected data.';
            }

        } catch (error) {
            console.error('AI Assistant: Error handling compile error', error);
            this.errorMessage = `Unexpected error: ${error}`;
        } finally {
            this.isProcessing = false;
            this.update();
        }
    }
}
