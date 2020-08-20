export class AssignmentGenerator {

    private static readonly BASE_URL = 'http://localhost:8080';

    private static makeURL(url: string): string {
        return `${AssignmentGenerator.BASE_URL}${url}`;
    }

    public static async generateAssignmentSources(assignment: Assignment) {
        const { courseID, id, files } = assignment;
        const urls = files.map(filename => 
            this.makeURL(`/assignment/ws.php?action=getFile&course=${courseID}&external=1&task_direct=${id}&file=${filename}`)
        );

        const promises = urls.map(url => fetch(url, { credentials: 'include' }).then(res => res.text()));
        const data = await Promise.all(promises);

        console.log(data);
    }

}