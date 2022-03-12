import { injectable } from 'inversify';
import * as JSZip from 'jszip';

export interface AssignmentDirectory {
    uri: string;
    subdirectories: AssignmentDirectory[];
    files: BinaryAssignmentFile[];
}

export interface AssignmentFile {
    path: string;
    name: string;
    content: string;
};

export interface BinaryAssignmentFile {
    path: string;
    name: string;
    content: Uint8Array;
}

@injectable()
export class Autotester {

    private makeURL(action: string, queryParams: string) {
        return `/autotester/server/push.php?action=${action}&${queryParams}`;
    }

    // Call getTask, not setTask?
    public async setTask(autotest: any): Promise<number> {
        const autotestQuery = encodeURIComponent(JSON.stringify(autotest));
        const url = this.makeURL('setTask', '');
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `task=${autotestQuery}`
        });
        const data = await res.json();

        console.log(JSON.stringify(data));

        return data.data;
    }

    public async setProgram(programID: number | undefined, taskID: number, programName: string): Promise<number> {
        const program: any = { task: taskID, name: programName };

        if(programID) {
            program.id = programID;
        }

        const programQuery = encodeURIComponent(JSON.stringify(program));
        const url = this.makeURL('setProgram', '');

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `program=${programQuery}`
        });

        const data = await res.json();
        return data.data;
    }

    public async setProgramFiles(programID: number, directory: AssignmentDirectory) {
        const url = this.makeURL('setProgramFile', `id=${programID}`);

        const zip = new JSZip();

        await this.traverse(directory, file => zip.file(file.path, file.content));

        const content = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });

        const formData = new FormData();
        formData.append('program', content);
        await fetch(url, {
            method: 'POST',
            body: formData
        });
    }

    private async traverse(directory: AssignmentDirectory, func: (dir: BinaryAssignmentFile) => void): Promise<void> {
        const subdirectoriesTraverse = directory.subdirectories.map(dir => this.traverse(dir, func));
        await Promise.all(subdirectoriesTraverse);
        
        directory.files.forEach(file => func(file));
    }

    public async getResults(programID: number) {
        const url = this.makeURL('getResult', `id=${programID}`);
        const res = await fetch(url);
        const data = await res.json();

        return data.data;
    }

    public async cancelProgram(programID: number) {
        const url = this.makeURL('cancelProgram', `id=${programID}`);
        const res = await fetch(url);
        const data = await res.json();

        return data.data;
    }

}
