import { injectable } from 'inversify';
import * as JSZip from 'jszip';

export interface AssignmentFile {
    uri: string;
    name: string;
    content: string;
};

@injectable()
export class Autotester {

    private makeURL(action: string, queryParams: string) {
        return `/autotester/server/push.php?action=${action}&${queryParams}`;
    }

    // Call getTask, not setTask?
    public async setTask(autotest: any): Promise<string> {
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

    public async setProgram(taskID: string): Promise<string> {
        const program = { task: taskID, name: '' };
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

    public async setProgramFiles(programID: string, files: AssignmentFile[]) {
        const url = this.makeURL('setProgramFile', `id=${programID}`);

        const zip = new JSZip();
        const nonHiddenFiles = files.filter(file => file.name[0] !== '.');
        nonHiddenFiles
            .forEach(file => zip.file(file.name, file.content));
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
