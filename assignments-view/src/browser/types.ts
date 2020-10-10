interface CourseInfo {
    id: string;
    name: string;
    abbrev: string;
    external: boolean;
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
