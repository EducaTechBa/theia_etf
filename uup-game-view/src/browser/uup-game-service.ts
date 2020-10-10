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
    tasksTurnedIn: number;
    points: number;
    currentTask: Task;
    buyingPowerUp: boolean;
    powerupsUsed: UsedPowerup[];
    collapsed: boolean;
}

export interface StudentData {
    student: string;
    tokens: number;
    points: number;
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

export interface PowerupResponse {
    success: boolean;
    message: string;
    powerupType: string;
    price: number;
    tokens: number;
}

export interface HintResponse {
    success: boolean;
    message: string;
    hint: string;
    tokens: number;
}

export interface SecondChanceResponse {
    success: boolean;
    message: string;
    taskData: Task;
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

    public async getTaskCategories() : Promise<void> {
        return Promise.resolve();
    }

    private async delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public async buyPowerup(powerupType: PowerupType) : Promise<PowerupResponse> {
        let powerupResponse = {
            success: false,
            message: "",
            powerupType: "1",
            price: 0,
            tokens: 0
        };
        await this.delay(10000).then( ()=> {
            powerupResponse = {
                "success": true,
                "message": "Powerup added to student mmesihovic1",
                "powerupType": "1",
                "price": 60,
                "tokens": 936
            };
        });   
        return Promise.resolve(powerupResponse); 
    }

    public async useHint(assignment: AssignmentDetails) : Promise<HintResponse> {
        let hintResponse = {
            success: false,
            message: "",
            hint: "",
            tokens: 0
        }
        await this.delay(10000).then( () => {
            hintResponse = {
                success: true,
                message: "m",
                hint: "Testni hint za neki zadatak",
                tokens: 0
            };
        });
        return Promise.resolve(hintResponse);
    }

    public async useSecondChance(assignment: AssignmentDetails) : Promise<SecondChanceResponse> {
        let secondChanceResponse = {
            success: false,
            message: "",
            taskData: {
                name: "",
                taskNumber: 0
            } 
        }
        await this.delay(10000).then( () => {
            secondChanceResponse = {
                success: true,
                message: "Second chance uspio",
                taskData: {
                    name: "Testni zadatak 3",
                    taskNumber: 3
                }
            };
        });
        return Promise.resolve(secondChanceResponse);
    }

    public async getSecondChanceAvailableTasks(assignment: AssignmentDetails) : Promise<Task[]> {
        return Promise.resolve([{
            "name": "Testni task 1",
            "taskNumber": 1
        },
        {
            "name": "Testni task 3",
            "taskNumber": 3
        },
        {
            "name": "Testni task 4",
            "taskNumber": 4
        }]
        );
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
            ],
            "currentTasks": [
                {
                    "assignment_id": 2,
                    "task_number": 9,
                    "task_name": "Task 100"
                },
            ],
            "assignmentPoints": [
                {
                    "assignment_id": 1,
                    "points": 2.94286
                },
                {
                    "assignment_id": 2,
                    "points": 1.57143
                }
            ],
            "completedTasks": [
                {
                    "assignment_id": 1,
                    "completed": "13"
                },
                {
                    "assignment_id": 2,
                    "completed": "7"
                }
            ],
            "turnedInTasks": [
                {
                    "assignment_id": 1,
                    "turned_in": "15"
                },
                {
                    "assignment_id": 2,
                    "turned_in": "8"
                }
            ]
        }
        let studentData: StudentData = {
            student: data.student,
            tokens: data.tokens,
            points: this.mapPoints(data),
            unusedPowerups: this.mapUnusedPowerupData(data.powerups, powerupTypes),
            assignmentsData: this.mapAssignmentDetails(data, assignments, powerupTypes, taskRequirement)
        }
        console.log("Student Data: ", studentData);
        return Promise.resolve(studentData);
    }

    private mapPoints(data: any): number {
        let points = 0;
        data.assignmentPoints.forEach( (x: any) => {
            points += x.points;
        });
        return points;
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
                let _ffIndex = data.completedTasks.findIndex( (x: any) => { return x.assignment_id == assignment.id; });
                let _tiIndex = data.turnedInTasks.findIndex( (x: any) => { return x.assignment_id == assignment.id; });
                let _assignmentDetails : AssignmentDetails = {
                    id: assignment.id,
                    name: assignment.name,
                    unlocked: true,
                    started: true,
                    finished: data.assignmentProgress[index].status == "Completed",
                    tasksFullyFinished: data.completedTasks[_ffIndex].completed,
                    tasksTurnedIn: data.turnedInTasks[_tiIndex].turned_in,
                    points: data.assignmentPoints[_pIndex].points,
                    currentTask: (_index == -1) ? {name:"-1", taskNumber: -1} : {
                        name: data.currentTasks[_index].task_name,
                        taskNumber: data.currentTasks[_index].task_number
                    },
                    buyingPowerUp: false,
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
                    tasksTurnedIn: 0,
                    points: 0,
                    currentTask: {name:"-1", taskNumber: -1},
                    buyingPowerUp: false,
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