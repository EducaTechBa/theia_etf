interface CourseInfo {
    id: string;
    name: string;
    abbrev: string;
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
};
