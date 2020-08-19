export class AssignmentsDataProvider {

    private static readonly BASE_URL = 'http://localhost:8080';

    private makeURL(url: string): string {
        return `${AssignmentsDataProvider.BASE_URL}${url}`;
    }

    public async login(username: string, password: string): Promise<void> {
        try {
            const url = this.makeURL('/services/auth.php');
            await fetch(url, {
                method: "post",
                body: `login=${encodeURIComponent(
                    username
                )}&password=${encodeURIComponent(password)}`,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            });
        } catch (err) {
            console.log(err);
        }
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

        console.log(JSON.stringify(json));

        return json.data.map((course: any) => ({
            id: course.id,
            name: course.name,
            abbrev: course.abbrev
        }));
    }

    private async getCourseDirectory(courseInfo: CourseInfo): Promise<Directory> {
        return this
            .getCourseData(courseInfo)
            .then(courseData => this.mapCourseDataToCourseDirectory(courseInfo, courseData));
    }

    private async getCourseData(courseInfo: CourseInfo): Promise<any> {
        const courseURL = (id: string) => this.makeURL(`/assignment/ws.php?action=assignments&external=1&course=${id}`);

        return fetch(courseURL(courseInfo.id), {
            credentials: 'include'
        }).then(res => res.json())
    }

    private mapCourseDataToCourseDirectory(courseInfo: CourseInfo, courseData: any): Directory {
        const tutorials = courseData.data;
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
        const assignments = tutorial.items.map((a: any) => this.mapAssignmentData(courseID, a));

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
        const files = assignment.files.map((f: any) => this.mapFileDataToFileName(f));

        return {
            id: assignment.id,
            name: assignment.name,
            courseID,
            path,
            files
        };
    }

    private mapFileDataToFileName(file: any): string {
        return typeof file === "string" ? file : file.filename;
    }

}

/*
{
    "success": "true",
    "message": "",
    "data": [
        {
            "id": 1,
            "type": "tutorial",
            "name": "Tutorijal 1",
            "path": "UUP\/T1",
            "hidden": "false",
            "items": [
                {
                    "id": 2,
                    "type": "zadatak",
                    "name": "Zadatak 1",
                    "path": "UUP\/T1\/Z1",
                    "files": [
                        {
                            "filename": ".autotest",
                            "binary": false,
                            "show": false
                        },
                        {
                            "filename": "main.c",
                            "binary": false,
                            "show": false
                        }
                    ],
                    "hidden": "false",
                    "items": []
                },
                {
                    "id": 3,
                    "type": "task",
                    "name": "Zadatak 2",
                    "path": "UUP\/T1\/Z2",
                    "files": [
                        {
                            "filename": ".autotest",
                            "binary": false,
                            "show": false
                        },
                        {
                            "filename": "main.c",
                            "binary": false,
                            "show": false
                        }
                    ],
                    "hidden": "false",
                    "items": []
                }
            ]
        },
        {
            "id": 4,
            "type": "tutorial",
            "name": "Tutorijal 2",
            "path": "UUP\/T2",
            "hidden": "false",
            "items": [
                {
                    "id": 5,
                    "type": "zadatak",
                    "name": "Zadatak 1",
                    "path": "UUP\/T2\/Z1",
                    "files": [
                        {
                            "filename": ".autotest",
                            "binary": false,
                            "show": false
                        },
                        {
                            "filename": "main.c",
                            "binary": false,
                            "show": false
                        }
                    ],
                    "hidden": "false",
                    "items": []
                }
            ]
        }
    ]
}
*/