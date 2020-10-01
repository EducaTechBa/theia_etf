export class AssignmentsDataProvider {

    private static readonly BASE_URL = '';

    private makeURL(url: string): string {
        return `${AssignmentsDataProvider.BASE_URL}${url}`;
    }

    public async getCoursesData(): Promise<Directory[]> {
        const coursesInfo: CourseInfo[] = await this.getStudentCoursesInfo();

        const coursePromises = coursesInfo.map((course: CourseInfo) => this.getCourseDirectory(course));
        const courseDirectories: Directory[] = await Promise.all(coursePromises);

        return Promise.resolve(courseDirectories);
    }

    private async getStudentCoursesInfo(): Promise<CourseInfo[]> {
        const url = this.makeURL('/assignment/ws.php?action=courses');
        const res = await fetch(url, {
            credentials: 'include'
        });

        const json = await res.json();

        return json.data.map((course: any) => ({
            id: course.id,
            name: course.name,
            abbrev: course.abbrev,
            external: course.external,
        }));
    }

    private async getCourseDirectory(courseInfo: CourseInfo): Promise<Directory> {
        return this
            .getCourseData(courseInfo)
            .then(courseData => this.mapCourseDataToCourseDirectory(courseInfo, courseData));
    }

    private async getCourseData(courseInfo: CourseInfo): Promise<any> {
        const external = courseInfo.external ? 'external=1' : '';
        const courseURL = (id: string) => this.makeURL(`/assignment/ws.php?action=assignments&${external}&course=${id}`);

        return fetch(courseURL(courseInfo.id), {
            credentials: 'include'
        }).then(res => res.json())
    }

    private mapCourseDataToCourseDirectory(courseInfo: CourseInfo, courseData: any): Directory {
        const tutorials = courseData.data ?? [];
        const subdirectories = tutorials.map((t: any) => this.mapTutorialDataToDirectory(courseInfo.id, t));

        return {
            id: courseInfo.id,
            name: courseInfo.name,
            path: courseInfo.abbrev,
            subdirectories,
            assignments: []
        };
    }

    private mapTutorialDataToDirectory(courseID: string, tutorial: any): Directory {
        const path = tutorial.path;
        const assignments = (tutorial.items ?? []).map((a: any) => this.mapAssignmentData(courseID, a));

        return {
            id: path,
            name: tutorial.name,
            path: path,
            subdirectories: [],
            assignments
        }
    }

    private mapAssignmentData(courseID: string, assignment: any): Assignment {
        const path = assignment.path;
        const files = (assignment.files ?? []).map((f: any) => this.mapFileData(f));

        return {
            id: assignment.id,
            name: assignment.name,
            courseID,
            path,
            files
        };
    }

    private mapFileData(file: any): any {
        return typeof file === "string" ? {
            binary: false,
            show: true,
            filename: file
        } : file;
    }

}
