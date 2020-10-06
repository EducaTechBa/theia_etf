import { DialogProps, AbstractDialog } from "@theia/core/lib/browser";
import { injectable, inject } from 'inversify';
import { Disposable } from "@theia/core";

@injectable()
export class SelectDialogProps<T> extends DialogProps {
    readonly items: T[];
    readonly ok?: string;
    readonly cancel?: string;
    readonly message?: string;
    readonly style: {};
    /**
     * Label provider for the `items`. If not specified `String(item)` will be used instead.
     */
    label?(item: T): string;
}

export class SelectDialog<T> extends AbstractDialog<T> {

    protected selectedIndex: number;
    protected items: T[];

    constructor(@inject(SelectDialogProps) protected readonly props: SelectDialogProps<T>) {
        super(props);
        this.selectedIndex = 0;
        this.items = this.props.items.slice();
        if (props.items.length < 1) {
            throw new Error("'props.items' cannot be empty.");
        }
        let messageDiv = document.createElement('div');
        messageDiv.setAttribute("class", "selectDialogueMessage");
        let messageSpan = document.createElement('span');
        messageSpan.innerHTML= props.message || "";
        messageDiv.appendChild(messageSpan);
        const select = document.createElement('select');
        select.setAttribute("class","selectDialogueDropdown");
        const label = this.props.label ? this.props.label : (item: T) => String(item);
        for (const item of this.items) {
            const option = document.createElement('option');
            option.text = label(item);
            option.value = label(item);
            select.appendChild(option);
        }
        const selectionListener = () => this.selectedIndex = select.selectedIndex;
        select.addEventListener('change', selectionListener);
        this.toDispose.push(Disposable.create(() => select.removeEventListener('change', selectionListener)));
        this.contentNode.appendChild(messageDiv);
        this.contentNode.appendChild(select);
        this.appendCloseButton(props.cancel || 'Cancel');
        this.appendAcceptButton(props.ok || 'Use Power-up');
    }

    get value(): T {
        return this.items[this.selectedIndex];
    }

}