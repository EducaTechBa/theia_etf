import { injectable, inject } from 'inversify';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import URI from '@theia/core/lib/common/uri';

@injectable()
export class AssignmentGenerator {

    private static readonly BASE_URL = '';
    private RETRY_TIMEOUT_MS = 1000;

    constructor(
        @inject(FileService) private readonly fileService: FileService,
    ) {}

    private makeURL(url: string): string {
        return `${AssignmentGenerator.BASE_URL}${url}`;
    }

    public async generateAssignmentSources(assignmentDirectory: string, assignment: Assignment) {
        try {
            await this.fileService.createFolder(new URI(assignmentDirectory));
        } catch(_) {
            console.log(`Directory ${assignmentDirectory} already exists...`);
        }

        const filesToGenerate = assignment.files.map(file => {
            this.retry(() => this.generateFile(assignmentDirectory, assignment, file))
        });
        await Promise.all(filesToGenerate);
    }

    private async retry(operation: Function) {
        try {
            await operation();
        } catch(err) {
            console.log(`Error generating file: ${err}`);
            await this.delay(this.RETRY_TIMEOUT_MS);
            await this.retry(operation);
        }
    }

    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async generateFile(dirURI: string, assignment: Assignment, file: any) {
        const content = await this.getFileContentFromServer(assignment, file)

        if(!file.binary) {
            const path = `${dirURI}/${file.filename}`;
            await this.fileService.create(new URI(path), content);
        }
    }

    private async getFileContentFromServer(assignment: Assignment, file: any): Promise<any> {
        const { courseID, id } = assignment;
        const url = this.makeURL(`/assignment/ws.php?action=getFile&course=${courseID}&external=1&task_direct=${id}&file=${file.filename}&replace=true`);
        const res = await fetch(url, { credentials: 'include' });
        if(res.status != 200) {
            throw Error('Error getting file content');
        }
        return await res.text();
    }

}