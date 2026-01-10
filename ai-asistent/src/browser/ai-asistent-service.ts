import { injectable } from 'inversify';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import URI from '@theia/core/lib/common/uri';
import { ApiResponse } from './ai-asistent-types';

export interface ValidationResult {
    valid: boolean;
    errorMessage?: string;
    showWarning?: 'whitespace' | 'compile-warn' | 'stale-gcc' | 'stale-asan' | 'crash-missing';
    context?: any;
}

@injectable()
export class AIAsistentService {

    constructor(
        private readonly fileService: FileService
    ) {}

    /**
     * Check if AI Assistant service is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch('/api/v1/ai/asistent?action=isAvailable', {
                credentials: 'include'
            });
            return response.ok;
        } catch (error) {
            console.warn('AI Assistant: Failed to check availability', error);
            return false;
        }
    }

    /**
     * Read and parse task.html file from the given directory
     * Returns plain text content or empty string if file not found
     */
    async readTaskSpecification(directoryUri: URI): Promise<string> {
        try {
            const taskUri = new URI(directoryUri.toString() + '/task.html');
            const taskFile = await this.fileService.read(taskUri);
            const htmlContent = taskFile.value;

            // Extract plain text from HTML
            return this.extractPlainTextFromHtml(htmlContent);
        } catch (error) {
            // File doesn't exist or can't be read - this is normal
            return '';
        }
    }

    /**
     * Extract plain text from HTML content
     * Removes all HTML tags and decodes HTML entities
     */
    private extractPlainTextFromHtml(html: string): string {
        // Remove script and style tags with their content
        let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

        // Remove HTML tags
        text = text.replace(/<[^>]+>/g, ' ');

        // Decode common HTML entities
        text = text.replace(/&nbsp;/g, ' ');
        text = text.replace(/&amp;/g, '&');
        text = text.replace(/&lt;/g, '<');
        text = text.replace(/&gt;/g, '>');
        text = text.replace(/&quot;/g, '"');
        text = text.replace(/&#39;/g, "'");
        text = text.replace(/&apos;/g, "'");

        // Normalize whitespace
        text = text.replace(/\s+/g, ' ').trim();

        return text;
    }

    /**
     * Validate output form inputs
     */
    validateOutputInputs(actualOutput: string, expectedOutput: string): ValidationResult {
        const expectedTrimmed = expectedOutput.trim();
        const actualTrimmed = actualOutput.trim();

        // Check 1: Expected output can't be empty
        if (expectedTrimmed === '') {
            return {
                valid: false,
                errorMessage: 'emptyExpectedMessage'
            };
        }

        // Check 2: Expected and actual output can't be equal
        if (expectedTrimmed === actualTrimmed) {
            return {
                valid: false,
                errorMessage: 'outputsEqualMessage'
            };
        }

        // Check 3: Whitespace-only difference warning
        if (expectedTrimmed.replace(/\s+/g, '') === actualTrimmed.replace(/\s+/g, '')) {
            return {
                valid: false,
                showWarning: 'whitespace'
            };
        }

        return { valid: true };
    }

    /**
     * Validate compile error inputs
     */
    async validateCompileInputs(
        fileUri: URI,
        gccOutUri: URI,
        gccOutput: string,
        gccFileExists: boolean
    ): Promise<ValidationResult> {
        // Validation 1: Check if gcc output is empty or file doesn't exist
        if (!gccFileExists || gccOutput.trim() === '') {
            return {
                valid: false,
                errorMessage: 'emptyGccMessage'
            };
        }

        // Validation 2: Check if gcc output contains "error" (case insensitive)
        if (!gccOutput.toLowerCase().includes('error')) {
            return {
                valid: false,
                showWarning: 'compile-warn'
            };
        }

        // Validation 3: Check if .gcc.out is older than source file
        try {
            const fileStats = await this.fileService.resolve(fileUri);
            const gccStats = await this.fileService.resolve(gccOutUri);
            if (gccStats.mtime && fileStats.mtime && gccStats.mtime < fileStats.mtime) {
                return {
                    valid: false,
                    showWarning: 'stale-gcc',
                    context: { fileUri, gccOutUri }
                };
            }
        } catch (error) {
            console.warn('AI Assistant: Could not check file timestamps', error);
        }

        return { valid: true };
    }

    /**
     * Validate crash inputs
     */
    async validateCrashInputs(
        fileUri: URI,
        asanOutUri: URI,
        asanOutput: string,
        asanFileExists: boolean
    ): Promise<ValidationResult> {
        // Check if .asan.out is missing or empty
        if (!asanFileExists || asanOutput.trim() === '') {
            return {
                valid: false,
                showWarning: 'crash-missing'
            };
        }

        // Check if .asan.out is older than source file
        try {
            const fileStats = await this.fileService.resolve(fileUri);
            const asanStats = await this.fileService.resolve(asanOutUri);
            if (asanStats.mtime && fileStats.mtime && asanStats.mtime < fileStats.mtime) {
                return {
                    valid: false,
                    showWarning: 'stale-asan',
                    context: { fileUri, asanOutUri }
                };
            }
        } catch (error) {
            console.warn('AI Assistant: Could not check file timestamps', error);
        }

        return { valid: true };
    }

    /**
     * Submit output wrong request
     */
    async submitOutputRequest(
        action: 'output' | 'output_whitespace',
        path: string,
        code: string,
        input: string,
        output: string,
        expected: string,
        task?: string,
        onPartialResponse?: (partialText: string) => void
    ): Promise<ApiResponse> {
        const formData = new FormData();
        formData.append('action', action);
        formData.append('path', path);
        formData.append('code', code);
        formData.append('input', input);
        formData.append('output', output);
        formData.append('expected', expected);
        if (task) {
            formData.append('task', task);
        }

        return this.submitRequest(formData, onPartialResponse);
    }

    /**
     * Submit compile error request
     */
    async submitCompileRequest(
        action: 'compile' | 'compile_warn',
        path: string,
        code: string,
        gccOutput: string,
        task?: string,
        onPartialResponse?: (partialText: string) => void
    ): Promise<ApiResponse> {
        const formData = new FormData();
        formData.append('action', action);
        formData.append('path', path);
        formData.append('code', code);
        formData.append('output', gccOutput);
        if (task) {
            formData.append('task', task);
        }

        return this.submitRequest(formData, onPartialResponse);
    }

    /**
     * Submit crash analysis request
     */
    async submitCrashRequest(
        action: 'crash',
        path: string,
        code: string,
        asanOutput: string,
        task?: string,
        onPartialResponse?: (partialText: string) => void
    ): Promise<ApiResponse> {
        const formData = new FormData();
        formData.append('action', action);
        formData.append('path', path);
        formData.append('code', code);
        formData.append('asan', asanOutput);
        if (task) {
            formData.append('task', task);
        }

        return this.submitRequest(formData, onPartialResponse);
    }

    /**
     * Submit autotest request (tests failing)
     */
    async submitAutotestRequest(
        path: string,
        code: string,
        autotestContent: string,
        atResultContent: string,
        task?: string,
        onPartialResponse?: (partialText: string) => void
    ): Promise<ApiResponse> {
        const formData = new FormData();
        formData.append('action', 'autotest');
        formData.append('path', path);
        formData.append('code', code);
        formData.append('autotest', autotestContent);
        formData.append('result', atResultContent);
        if (task) {
            formData.append('task', task);
        }

        return this.submitRequest(formData, onPartialResponse);
    }

    /**
     * Submit user feedback
     */
    async submitFeedback(
        path: string,
        feedback: string,
        onPartialResponse?: (partialText: string) => void
    ): Promise<ApiResponse> {
        const formData = new FormData();
        formData.append('action', 'feedback');
        formData.append('path', path);
        formData.append('feedback', feedback);

        return this.submitRequest(formData, onPartialResponse);
    }

    /**
     * Generic request submission
     */
    private async submitRequest(
        formData: FormData,
        onPartialResponse?: (partialText: string) => void
    ): Promise<ApiResponse> {
        try {
            const response = await fetch('/api/v1/ai/asistent', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            // Handle background task (HTTP 299)
            if (response.status === 299) {
                const data = await response.json();
                if (data.data && data.data.uid) {
                    console.log('AI Assistant: Background task started, uid:', data.data.uid);
                    return this.pollBackgroundTask(data.data.uid, onPartialResponse);
                } else {
                    return { error: 'Background task started but no UID provided' };
                }
            }

            if (!response.ok) {
                return this.handleApiError(response);
            }

            const data = await response.json();

            if (data.data) {
                return { data: data.data };
            } else {
                return { error: 'apiError' };
            }

        } catch (error) {
            console.error('AI Assistant: Request error', error);
            return { error: `Unexpected error: ${error}` };
        }
    }

    /**
     * Poll background task status until completion
     * Calls onPartialResponse callback with incremental updates for typing effect
     */
    private async pollBackgroundTask(
        uid: string,
        onPartialResponse?: (partialText: string) => void
    ): Promise<ApiResponse> {
        const pollInterval = 1000; // 1 second
        const maxAttempts = 600; // 10 minutes max (600 * 1 second)
        let bytesReceived = 0;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Wait before polling (except first attempt)
            if (attempt > 0) {
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }

            try {
                console.log(`AI Assistant: Polling status (attempt ${attempt + 1}/${maxAttempts})`);
                const url = `/api/v1/ai/asistent?action=check_status&uid=${uid}&start=${bytesReceived}`;
                const response = await fetch(url, {
                    method: 'GET',
                    credentials: 'include'
                });

                // Still processing - may have partial output
                if (response.status === 299) {
                    const responseData = await response.json();

                    // Extract partial text from nested structure: responseData.data.data
                    const partialText = responseData.data?.data;

                    // If there's partial data, send it to callback for typing effect
                    if (partialText && typeof partialText === 'string' && partialText.length > 0) {
                        console.log(`AI Assistant: Received ${partialText.length} bytes of partial output`);
                        bytesReceived += partialText.length;
                        if (onPartialResponse) {
                            onPartialResponse(partialText);
                        }
                    } else {
                        console.log('AI Assistant: Task still running...');
                    }
                    continue;
                }

                // Task completed
                if (response.status === 200) {
                    const data = await response.json();
                    console.log('AI Assistant: Background task completed');
                    if (data.data) {
                        return { data: data.data };
                    } else {
                        return { error: 'apiError' };
                    }
                }

                // Error status
                return this.handleApiError(response);

            } catch (error) {
                console.error('AI Assistant: Error polling status', error);
                return { error: `Polling error: ${error}` };
            }
        }

        // Timeout after max attempts
        return { error: 'Background task timed out after 10 minutes' };
    }

    /**
     * Handle API errors
     */
    private async handleApiError(response: Response): Promise<ApiResponse> {
        if (response.status === 400) {
            try {
                const errorData = await response.json();
                if (errorData.message === 'Too many requests') {
                    return { error: 'QUOTA_EXCEEDED' };
                }
                return { error: errorData.error || errorData.message || 'Bad request' };
            } catch {
                return { error: 'Bad request' };
            }
        } else if (response.status === 401) {
            return { error: 'Unauthorized. Please log in again.' };
        } else if (response.status === 500) {
            return { error: 'Server error. Please try again later.' };
        } else {
            return { error: `HTTP error: ${response.status}` };
        }
    }

    /**
     * Strip ANSI escape codes from terminal output
     */
    stripAnsiCodes(text: string): string {
        // eslint-disable-next-line no-control-regex
        return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    }
}
