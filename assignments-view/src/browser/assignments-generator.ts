import { injectable, inject } from 'inversify';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import URI from '@theia/core/lib/common/uri';
import { RetriableOperation } from './retriable-operation'
import { ConfirmDialog } from '@theia/core/lib/browser';
// @ts-ignore
import { SessionManager } from 'top-bar/lib/browser/session-manager';

@injectable()
export class AssignmentGenerator {

    private static readonly BASE_URL = '';
    private RETRY_TIMEOUT_MS = 1000;

    constructor(
        @inject(FileService) private readonly fileService: FileService,
        @inject(SessionManager) private readonly sessionManager: SessionManager,
    ) {}

    private makeURL(url: string): string {
        return `${AssignmentGenerator.BASE_URL}${url}`;
    }

    public async generateAssignmentSources(assignmentDirectory: string, assignment: Assignment) {
        const dialog = new ConfirmDialog({
            title: 'Opening files',
            msg: `Please wait while files are opened`,
            ok: "Ok"
        });
        dialog.open();
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
        dialog.close()
    }

    private async generateFile(dirURI: string, assignment: Assignment, file: any) {
        const path = `${dirURI}/${file.filename}`;
        const uri = new URI(path);
        try {
            await this.fileService.resolve(uri);
            console.log(`File ${file.filename} already exists...`);
            return;
        } catch(_) {
            console.log(`Generating ${file.filename}...`);
        }

        if(!file.binary) {
            const content = await this.getFileContentFromServer(assignment, file)
            await this.fileService.create(uri, content);
        } else {
            await this.deployFileOnServer(assignment, file)
        }
        // If file is still not there, this ensures another attempt
        await this.fileService.resolve(uri);
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
    
   private async deployFileOnServer(assignment: Assignment, file: any): Promise<any> {
        const { courseID, id } = assignment;
        const userInfo = await this.sessionManager.getUserInfo();
        const url = this.makeURL(`/api/v1/assignment/${courseID}/${id}/file/${file.filename}/deploy?replace=true&username=${userInfo.username}`);
        const res = await fetch(url, { credentials: 'include' });
        if(res.status != 200) {
            throw Error('Error getting file content');
        }
        return await res.text();
    }
}
