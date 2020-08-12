interface Family {
    name: string;
    members: Member[];
}

interface Member {
    firstName: string;
    nickName: string;
    children?: Member[];
}
