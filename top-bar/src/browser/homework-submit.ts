import { injectable, inject } from 'inversify';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
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
        const url = `/zamger/slanje_zadace.php?zadaca=${homework.id}&zadatak=${homework.zadatak}&filename=${homeworkContentFilePath}`;

        await fetch(url, {
            method: 'GET',
            credentials: 'include'
        });
    }

    public async isHomeworkAssignment(dirURI: string): Promise<boolean> {
        const relDirURI = dirURI.slice(this.workspaceService.workspace?.resource.toString().length);
        const homeworkFilePath = `${relDirURI}/${HomeworkSubmit.HOMEWORK_FILE_NAME}`;
        return this.workspaceService.containsSome([ homeworkFilePath ]);
    }

}
