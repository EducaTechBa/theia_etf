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
                credentials: 'include',
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

    public async getCoursesDataDummy(): Promise<Courses> {
        return Promise.resolve({
            courses: [
                {
                    id: 'UUP',
                    name: 'UUP',
                    tutorials: [
                        {
                            id: 'UUP/T1',
                            name: 'Tutorial 1',
                            assignments: [
                                {
                                    id: 'UUP/T1/Z1',
                                    name: 'Zadatak 1'
                                }
                            ]
                        }
                    ]
                }
            ]
        });
    }

    public async getCoursesData(): Promise<Courses> {
        const coursesInfo: CourseInfo[] = await this.getStudentCoursesInfo();

        const coursePromises = coursesInfo.map((course: CourseInfo) => this.getCourse(course));
        const courses: Course[] = await Promise.all(coursePromises);

        return Promise.resolve({ courses });
    }

    private async getStudentCoursesInfo(): Promise<CourseInfo[]> {
        const url = this.makeURL('/ass ignment/ws.php?action=courses');
        const res = await fetch(url, {
            credentials: 'include'
        });

        const json = await res.json();

        console.log(JSON.stringify(json));

        return json.data.map((course: any) => ({
            id: course.abbrev,
            name: course.name
        }));
    }

    private async getCourse(courseInfo: CourseInfo): Promise<Course> {
        const courseURL = (id: string) => this.makeURL(`/assignment/ws.php?action=assignments&external=1&course=${id}`);

        return fetch(courseURL(courseInfo.id), {
            credentials: 'include'
        })
            .then(res => res.json())
            .then(courseTutorials => this.mapResponseToCourse(courseInfo, courseTutorials));
    }

    private mapResponseToCourse(courseInfo: CourseInfo, courseTutorials: any): Course {
        const tutorialsData = courseTutorials.data;
        const tutorials: Tutorial[] = tutorialsData.map((c9Tutorial: any) => this.mapResponseToTutorial(c9Tutorial));

        return {
            id: courseInfo.id,
            name: courseInfo.name,
            tutorials
        }
    }

    private mapResponseToTutorial(c9Tutorial: any): Tutorial {
        const c9Assignments = c9Tutorial.items;
        const assignments: Assignment[] = c9Assignments.map((c9Assignment: any) => this.mapResponseToAssignment(c9Assignment));

        return {
            id: c9Tutorial.id,
            name: c9Tutorial.name,
            assignments
        }
    }

    private mapResponseToAssignment(c9Assignment: any): Assignment {
        return {
            id: c9Assignment.id,
            name: c9Assignment.name
        };
    }

}

interface CourseInfo {
    id: string;
    name: string;
}
