interface Courses {
    courses: Course[];
}

interface Course {
    id: string,
    name: string;
    tutorials: Tutorial[];
}

interface Tutorial {
    id: string,
    name: string;
    assignments: Assignment[];
}

interface Assignment {
    id: string,
    title: string;
    language: string;
}
