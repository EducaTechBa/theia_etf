import { injectable } from 'inversify';
import * as JSZip from 'jszip';
import { StatefulWidget } from '@theia/core/lib/browser';

interface AutotesterState {
    programIDs: any
};

namespace AutotesterState {
    export function is(obj: object): obj is AutotesterState {
        return !!obj && "programIDs" in obj;
    }
}

@injectable()
export class Autotester implements StatefulWidget {

    private state: AutotesterState;

    storeState(): object {
        return this.state;
    }

    restoreState(oldState: object): void {
        this.state = AutotesterState.is(oldState) ? oldState as AutotesterState : {
            programIDs: {
                '4093': '32777'
            }
        };
    }

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
        console.log(JSON.stringify(this.state));

        const program = { task: taskID, name: '' };
        const programQuery = encodeURIComponent(JSON.stringify(program));
        const url = this.makeURL('setProgram', `program=${programQuery}`);

        const res = await fetch(url, {
            method: 'POST'
        });

        const data = await res.json();
        return data.data;
    }

    // TODO: Remove. This method will not be used...
    public async getPrograms(taskID: string): Promise<any> {
        const url = this.makeURL('listPrograms', `task=${taskID}`)
        const res = await fetch(url);
        const data = await res.json();

        return data.data;
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
        const data = await res.text();

        console.log(data);
    }

    public async writeAutotestResultsFile() {
        // TODO: Implement
    }

    public async retest(programID: string) {
        const url = this.makeURL('retest', `id=${programID}`);
        const res = await fetch(url, {
            method: 'POST'
        });
        const data = await res.text();

        console.log(data);
    }

}
