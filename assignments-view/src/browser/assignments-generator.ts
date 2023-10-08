import { injectable, inject } from 'inversify';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import URI from '@theia/core/lib/common/uri';
import { RetriableOperation } from './retriable-operation'

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
            const operation = () => this.generateFile(assignmentDirectory, assignment, file);
            const retriable = new RetriableOperation(operation, this.RETRY_TIMEOUT_MS);
            return retriable.run();
        });
        await Promise.all(filesToGenerate);
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
        const url = this.makeURL(`/api/v1/assignment/${courseID}/${id}/file/${file.filename}?replace=true`);
        const res = await fetch(url, { credentials: 'include' });
        if(res.status != 200) {
            throw Error('Error getting file content');
        }
        return await res.text();
    }

}
