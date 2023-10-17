import { injectable, inject } from 'inversify';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { EditorManager } from '@theia/editor/lib/browser';
import { ConfirmDialog } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';

@injectable()
export class HomeworkSubmit {

    private static readonly HOMEWORK_FILE_NAME = '.zadaca';

    @inject(EditorManager)
    protected readonly editorManager!: EditorManager;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(FileService)
    protected readonly fileService: FileService;

    public async submitHomework(dirURI: string) {
        if(!this.isHomeworkAssignment(dirURI)) {
            return;
        }
        
        const homeworkFilePath = `${dirURI}/${HomeworkSubmit.HOMEWORK_FILE_NAME}`;
        const homeworkFile = await this.fileService.read(new URI(homeworkFilePath));
        const homework = JSON.parse(homeworkFile.value);

        const editorWidget = this.editorManager.currentEditor;
        let homeworkContentFilePath = `${dirURI}/`;
        if (editorWidget) {
            const names = editorWidget.getResourceUri()?.toString().split('/');
            const index = names?.length? names.length-1:-1;
            if(index!==-1 && names) {
                homeworkContentFilePath+=names[index];
            }
        }
        // filename query parameter is used by the service to determine the 
        // file directory... the homeworkFilePath is sufficient...
        const url = `/api/v1/zamger/submit_homework?homework=${homework.id}&assignment=${homework.zadatak}&filename=${homeworkContentFilePath}`;

        const res = await fetch(url, {
            method: 'GET',
            credentials: 'include'
        });
        const data = await res.json();
        
        if (res.status == 200) {
            const dialog = new ConfirmDialog({
                title: 'Success',
                msg: 'File submitted successfully',
                ok: "Ok"
            });
            dialog.open();        
        } else {
            let message = "(" + res.status + ") ";
            if (data.hasOwnProperty('message'))
                message += data.message;
            else
                message += "Server error sending file. Please contact the administrator";
            const dialog = new ConfirmDialog({
                title: 'Error submitting file',
                msg: message,
                ok: "Ok"
            });
            dialog.open();        
        }
    }

    public async isHomeworkAssignment(dirURI: string): Promise<boolean> {
        const relDirURI = dirURI.slice(this.workspaceService.workspace?.resource.toString().length);
        const homeworkFilePath = `${relDirURI}/${HomeworkSubmit.HOMEWORK_FILE_NAME}`;
        return this.workspaceService.containsSome([ homeworkFilePath ]);
    }

}
