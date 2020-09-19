import { injectable, /*inject*/ } from "inversify";
//import { Emitter } from '@theia/core/lib/common/event';

export interface Task {
    taskNumber: number;
    name: string;
}

export interface PowerupType {
    id: number;
    name: string;
    price: number;
}

export interface UsedPowerup {
    name: string;
    taskNumber: number;
}

export interface Assignment {
    id: number;
    name: string;
    active: boolean;
    points: number;
    challenge_pts: number;
}

export interface AssignmentDetails {
    id: number;
    name: string;
    unlocked: boolean; 
    started: boolean;
    finished: boolean;
    tasksFullyFinished: number;
    points: number;
    currentTask: Task;
    powerupsUsed: UsedPowerup[];
    collapsed: boolean;
}

export interface StudentData {
    student: string;
    tokens: number;
    unusedPowerups: {name: string, amount: number}[];
    assignmentsData: AssignmentDetails[];
}

export interface ChallengeConfig {
    enoughPoints: number,
    noPowerups: number,
    maxPoints: number,
    maxPointsNoPowerups: number,
    tasksRequired: number
}

@injectable()
export class GameService {

    public async getAssignments() : Promise<Assignment[]> {
        return Promise.resolve([
            {
                "id": 1,
                "name": "Lesson 1",
                "active": true,
                "points": 3,
                "challenge_pts": 2
            },
            {
                "id": 2,
                "name": "Lesson 2",
                "active": true,
                "points": 3,
                "challenge_pts": 2
            },
            {
                "id": 3,
                "name": "Lesson 3",
                "active": true,
                "points": 3,
                "challenge_pts": 2
            },
            {
                "id": 4,
                "name": "Lesson 4",
                "active": true,
                "points": 3,
                "challenge_pts": 2
            },
            {
                "id": 5,
                "name": "Lesson 5",
                "active": true,
                "points": 3,
                "challenge_pts": 2
            },
            {
                "id": 6,
                "name": "Lesson 6",
                "active": false,
                "points": 3,
                "challenge_pts": 2
            },
            {
                "id": 7,
                "name": "Lesson 7",
                "active": false,
                "points": 3,
                "challenge_pts": 2
            },
            {
                "id": 8,
                "name": "Lesson 8",
                "active": false,
                "points": 3,
                "challenge_pts": 2
            },
            {
                "id": 9,
                "name": "Lesson 9",
                "active": false,
                "points": 3,
                "challenge_pts": 2
            },
            {
                "id": 10,
                "name": "Lesson 10",
                "active": false,
                "points": 3,
                "challenge_pts": 2
            }
        ]);
    }

    public async getPowerupTypes() : Promise<PowerupType[]> {
        return Promise.resolve([
            {
                "id": 1,
                "name": "Hint",
                "price": 60
            },
            {
                "id": 2,
                "name": "Second Chance",
                "price": 100
            },
            {
                "id": 3,
                "name": "Switch Task",
                "price": 140
            }
        ]);
    }

    public async getChallengeConfig() : Promise<ChallengeConfig> {
        return Promise.resolve({
            enoughPoints: 60,
            noPowerups: 100,
            maxPoints: 140,
            maxPointsNoPowerups: 300,
            tasksRequired: 5
        })
    }

    public async getStudentData(assignments: Assignment[], powerupTypes: PowerupType[], taskRequirement: number) : Promise<StudentData> {
        let data = {
            "student": "mmesihovic1",
            "tokens": 1056,
            "powerups": [
                {
                    "type_id": 3,
                    "used": false,
                    "assignment_id": null,
                    "task_number": null
                },
                {
                    "type_id": 1,
                    "used": false,
                    "assignment_id": null,
                    "task_number": null
                },
                {
                    "type_id": 2,
                    "used": true,
                    "assignment_id": 1,
                    "task_number": 12
                },
                {
                    "type_id": 1,
                    "used": false,
                    "assignment_id": null,
                    "task_number": null
                }
            ],
            "assignmentProgress": [
                {
                    "assignment_id": 1,
                    "status": "Completed"
                },
                {
                    "assignment_id": 2,
                    "status": "In Progress"
                },
                {
                    "assignment_id": 3,
                    "status": "Completed"
                }
            ],
            "currentTasks": [
                {
                    "assignment_id": 2,
                    "task_number": 9,
                    "task_name": "Task 100"
                }
            ],
            "assignmentPoints": [
                {
                    "assignment_id": 1,
                    "points": 2.94286,
                    "count": "15"
                },
                {
                    "assignment_id": 2,
                    "points": 1.57143,
                    "count": "8"
                },
                {
                    "assignment_id": 3,
                    "points": 3,
                    "count": "15"
                }
            ]
        };
        let studentData: StudentData = {
            student: data.student,
            tokens: data.tokens,
            unusedPowerups: this.mapUnusedPowerupData(data.powerups, powerupTypes),
            assignmentsData: this.mapAssignmentDetails(data, assignments, powerupTypes, taskRequirement)
        }
        console.log("Student Data: ", studentData);
        return Promise.resolve(studentData);
    }

    private mapUsedPowerupData(data: any, powerupTypes: PowerupType[], _assignment_id: number): UsedPowerup[] {
        let _used : UsedPowerup[] = [];
        for(const {type_id, used, assignment_id, task_number} of data) {    
            let typeData = powerupTypes.find( (x) => { return x.id == type_id});  
            if(typeData && used && _assignment_id == assignment_id) {
                _used.push({name: typeData?.name, taskNumber: task_number});
            }
        }
        return _used;
    }

    private mapUnusedPowerupData(data: any, powerupTypes: PowerupType[]) {
        let _unused : {name: string, amount: number}[] = [];
        for(const {type_id, used} of data) {    
            let typeData = powerupTypes.find( (x) => { return x.id == type_id});  
            if(typeData && !used) {
                let index = _unused.findIndex((x)=>{ return x.name == typeData?.name})
                if( index == -1)
                    _unused.push({name: typeData.name, amount: 1});
                else _unused[index].amount += 1;
            }
        }
        return _unused;
    }

    private mapAssignmentDetails(data : any, assignmentsData: Assignment[], powerupTypes: PowerupType[], taskRequirement: number): AssignmentDetails[] {
        let assignments: AssignmentDetails[] = [];
        assignmentsData = assignmentsData.filter( (x) => { return x.active;});
        assignmentsData.forEach( (assignment) => {
            let index = data.assignmentProgress.findIndex( (x: any) => { return x.assignment_id == assignment.id; } );
            if(index != -1) {
                let _index = data.currentTasks.findIndex( (x: any) => { return x.assignment_id == assignment.id; } );
                let _pIndex = data.assignmentPoints.findIndex( (x: any) => { return x.assignment_id == assignment.id; });
                let _assignmentDetails : AssignmentDetails = {
                    id: assignment.id,
                    name: assignment.name,
                    unlocked: true,
                    started: true,
                    finished: data.assignmentProgress[index].status == "Completed",
                    tasksFullyFinished: data.assignmentPoints[_pIndex].count,
                    points: data.assignmentPoints[_pIndex].points,
                    currentTask: (_index == -1) ? {name:"-1", taskNumber: -1} : {
                        name: data.currentTasks[_index].task_name,
                        taskNumber: data.currentTasks[_index].task_number
                    },
                    powerupsUsed : this.mapUsedPowerupData(data.powerups, powerupTypes, assignment.id),
                    collapsed: false
                }
                assignments.push(_assignmentDetails);
            } else {
                let _assignmentDetails : AssignmentDetails = {
                    id: assignment.id,
                    name: assignment.name,
                    unlocked: false,
                    started: false,
                    finished: false,
                    tasksFullyFinished: 0,
                    points: 0,
                    currentTask: {name:"-1", taskNumber: -1},
                    powerupsUsed: [],
                    collapsed: false
                }
                assignments.push(_assignmentDetails);
            }
        });
        assignments[0].unlocked = true;
        for(let i=1;i<assignments.length;i++)
            assignments[i].unlocked = (assignments[i-1].tasksFullyFinished >= taskRequirement);
        return assignments;
    }

}