import URI from '@theia/core/lib/common/uri';

export interface WarningContext {
    relativePath?: string;
    code?: string;
    gccOutput?: string;
    asanOutput?: string;
    task?: string;
    fileUri?: URI;
    gccOutUri?: URI;
    asanOutUri?: URI;
}

export interface ApiResponse {
    data?: string;
    error?: string;
}

export type ActionType =
    | 'output'
    | 'output_whitespace'
    | 'compile'
    | 'compile_warn'
    | 'crash'
    | 'tests'
    | 'feedback';
