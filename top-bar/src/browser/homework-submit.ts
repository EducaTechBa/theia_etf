import { injectable, inject } from 'inversify';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { FileSystem } from '@theia/filesystem/lib/common'

@injectable()
export class HomeworkSubmit {

    private static readonly HOMEWORK_FILE_NAME = '.zadaca';

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(FileSystem)
    protected readonly fileSystem: FileSystem;

    public async submitHomework(dirURI: string) {
        if(!this.isHomeworkAssignment(dirURI)) {
            return;
        }

        const homeworkFilePath = `${dirURI}/${HomeworkSubmit.HOMEWORK_FILE_NAME}`;
        const homeworkFile = await this.fileSystem.resolveContent(homeworkFilePath);
        const homework = JSON.parse(homeworkFile.content);

        // filename query parameter is used by the service to determine the 
        // file directory... the homeworkFilePath is sufficient...
        const url = `/zamger/slanje_zadace.php?zadaca=${homework.id}&zadatak=${homework.zadatak}&filename=${homeworkFilePath}`;

        await fetch(url, {
            method: 'GET',
            credentials: 'include'
        });
    }

    public async isHomeworkAssignment(dirURI: string): Promise<boolean> {
        const homeworkFilePath = `${dirURI}/${HomeworkSubmit.HOMEWORK_FILE_NAME}`;
        console.log(`Zadaca path: ${homeworkFilePath}`);
        return this.workspaceService.containsSome([ homeworkFilePath ]);
    }

}
