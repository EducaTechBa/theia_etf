import * as React from 'react';
import { injectable } from 'inversify';
import { ReactDialog } from '@theia/core/lib/browser/dialogs/react-dialog';

@injectable()
export class FeedbackDialog extends ReactDialog<boolean> {
    private success: boolean = false;

    constructor() {
        super({
            title: 'Feedback',
            maxWidth: 480,
            wordWrap: "normal"
        });
    }

    get value(): boolean { return this.success; }

    protected render(): React.ReactNode {
        return <div>
            <p>Enter a short message describing your experience with Theia or report a bug:</p>
            <textarea className="theia-input" name="feedback-input"></textarea>
            <div className="button=bar">
                <button
                    className="theia-button primary"
                    title="Submit"
                    onClick={() => this.handleFeedbackSubmit()}
                >
                    Submit
                </button>
            </div>
        </div>;
    }

    private async handleFeedbackSubmit() {
        // TODO: do fetch request to submit answer
        this.success = true;
        this.accept();
    }

}
