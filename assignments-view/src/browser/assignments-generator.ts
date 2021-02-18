import { injectable, inject } from 'inversify';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import URI from '@theia/core/lib/common/uri';

@injectable()
export class AssignmentGenerator {

    private static readonly BASE_URL = '';

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

        const { courseID, id, files } = assignment;
        const filesWithURL = files.map(file => {
            const url = this.makeURL(`/assignment/ws.php?action=getFile&course=${courseID}&external=1&task_direct=${id}&file=${file.filename}&replace=true`)
            return {
                ...file,
                url
            };
        });

        const promises = filesWithURL
            .map(file =>
                fetch(file.url, { credentials: 'include' })
                    .then(res => res.text())
                    .then(content => ({
                        ...file,
                        content
                    }))
            );
        
        const data = await Promise.all(promises);

        const filesToGenerate = data.map(file => this.generateFile(assignmentDirectory, file));
        await Promise.all(filesToGenerate);
    }

    private async generateFile(dirURI: string, file: any) {
        if(file.binary) {
            return;
        }

        const path = `${dirURI}/${file.filename}`;

        await this.fileService.create(new URI(path), file.content);
    }

}