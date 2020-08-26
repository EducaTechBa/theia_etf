import { injectable } from 'inversify';
import * as JSZip from 'jszip';

@injectable()
export class Autotester {

    private makeURL(action: string, queryParams: string) {
        return `/autotester/server/push.php?action=${action}&${queryParams}`;
    }

    public async setTask(autotest: any): Promise<string> {
        const autotestQuery = encodeURIComponent(JSON.stringify(autotest));
        const url = this.makeURL('setTask', `task=${autotestQuery}`);
        const res = await fetch(url, {
            method: 'POST'
        });
        const data = await res.json();

        console.log(JSON.stringify(data));

        return data.data;
    }

    public async setProgram(taskID: string): Promise<string> {
        const program = { task: taskID, name: '' };
        const programQuery = encodeURIComponent(JSON.stringify(program));
        const url = this.makeURL('setProgram', `program=${programQuery}`);

        const res = await fetch(url, {
            method: 'POST'
        });

        const data = await res.json();
        return data.data;
    }

    public async setProgramFiles(programID: string, files: AssignmentFile[]) {
        const url = this.makeURL('setProgramFile', `id=${programID}`);

        const zip = new JSZip();
        files.forEach(file => zip.file(file.name, file.content));
        const content = await zip.generateAsync({ type: 'blob' });

        const formData = new FormData();
        formData.append('program', content);
        await fetch(url, {
            method: 'POST',
            body: formData
        });
    }

    public async setProgramFile(programID: string, filename: string, filecontent: string) {
        const url = this.makeURL('setProgramFile', `id=${programID}`);

        const zip = new JSZip();
        zip.file(filename, filecontent);
        const content = await zip.generateAsync({ type: 'blob' });

        const formData = new FormData();
        formData.append('program', content);
        await fetch(url, {
            method: 'POST',
            body: formData
        });
    }

    public async getResults(programID: string) {
        const url = this.makeURL('getResult', `id=${programID}`);
        const res = await fetch(url);
        const data = await res.json();

        return data.data;
    }

}

export interface AssignmentFile {
    uri: string;
    name: string;
    content: string;
} 
