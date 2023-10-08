interface CourseInfo {
    id: string;
    year: string;
    name: string;
    abbrev: string;
    external: boolean;
    str: string;
}

interface Directory {
    id: string;
    name: string;
    path: string;
    subdirectories: Directory[];
    assignments: Assignment[];
};

interface Assignment {
    id: string;
    name: string;
    path: string;
    courseID: string;
    files: any[];
};
