import { injectable } from 'inversify';
import * as JSZip from 'jszip';

@injectable()
export class Autotester {

    public async setTask(): Promise<string> {
        return "";
    }

    public async getPrograms(taskID: string): Promise<any> {
        const res = await fetch(`/autotester/server/push.php?action=listPrograms&task=${taskID}`);
        const data = await res.json();

        return data.data;
    }

    public async setProgramFile(programID: string, filename: string, filecontent: string) {
        // read file contetn
        // cosnt formData = new FormData()
        // formData.append(fileContent);
        // fetch('', { data: formData })

        // program id: 32777
        const program_id = 32777;
        const url = `/autotester/server/push.php?action=setProgramFile&id=${program_id}`;

        const zip = new JSZip();
        zip.file(filename, filecontent);
        zip.generateAsync({ type: 'blob' })
            .then(content => {
                const formData = new FormData();
                formData.append('program', content);
                fetch(url, {
                    method: 'POST',
                    body: formData
                }).then(res => res.text())
                .then(data => console.log(data))
                .catch(err => console.log(err));
            })
            .catch(err => console.log(err));
    }

}
