interface Courses {
    courses: Course[];
}

interface Course {
    name: string;
    tutorials: Tutorial[];
}

interface Tutorial {
    name: string;
    assignments: Assignment[];
}

interface Assignment {
    title: string;
    language: string;
}
