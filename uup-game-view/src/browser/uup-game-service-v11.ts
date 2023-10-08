import { injectable } from "inversify";


export interface ServerResponseV11 {
    success: boolean;
    message: string;
    data: any;
    code: number;
}

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
    path: string;
    active: boolean;
    points: number;
    challenge_pts: number;
}

export interface TaskCategory {
    id: number;
    name: string;
    points_percent: number;
    tokens: number;
    tasks_per_category: number;
}

export interface AssignmentDetails {
    id: number;
    name: string;
    path: string;
    unlocked: boolean;
    started: boolean;
    finished: boolean;
    tasksFullyFinished: number;
    tasksTurnedIn: number;
    previousPoints: number;
    points: number;
    currentTask: Task;
    taskHint: string;
    buyingPowerUp: boolean;
    powerupsUsed: UsedPowerup[];
    collapsed: boolean;
    assignmentTime: number;
    taskTime: number;
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
    taskData: {};
}

export interface ServerResponse {
    success: boolean;
    message: string;
    data: any;
}

export interface CourseInfo {
    id: string;
    name: string;
    abbrev: string;
    external: boolean;
}


@injectable()
export class GameServiceV11 {
    private BASE_URL = "/api/v1/game/"


    private mapResponse(serverResponse: any, statusCode: number) : ServerResponseV11  {
        let response = {
            success: false,
            message: "",
            data: {},
            code: statusCode
        };
        
        let data = Object.keys(serverResponse).includes('data') ? serverResponse.data : {};

        if(!serverResponse.success) {
            response = {
                success: serverResponse.success,
                message: Object.keys(data).includes('reason') ? data.reason : serverResponse.message,
                data: data,
                code: statusCode
            }
        }
        else response = {
            success: serverResponse.success,
            message: Object.keys(data).includes('reason') ? data.message : serverResponse.message,
            data: data,
            code: statusCode
        }
        return response;
    }

    public async getGameStatus() : Promise<ServerResponseV11> {
        let requestURL = this.BASE_URL + `status`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include"
        })
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data, res.status));
    }

    public async getAssignments() : Promise<Assignment[]> {
        let requestURL = this.BASE_URL + `assignments`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include"
        })
        let data = await res.json();
        return Promise.resolve(data.data);
    }

    public async getPowerupTypes() : Promise<PowerupType[]> {
        let requestURL = this.BASE_URL + `powerup_types`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include"
        })
        let data = await res.json();
        return Promise.resolve(data.data);
    }

    public async getChallengeConfig() : Promise<ChallengeConfig> {
        let requestURL = this.BASE_URL + `challenge_config`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include"
        })
        let data = await res.json();
        return Promise.resolve(data.data);
    }

    public async getTaskCategories() : Promise<TaskCategory[]> {
        let requestURL = this.BASE_URL + `task_categories`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include"
        })
        let data = await res.json();
        return Promise.resolve(data.data);
    }

    public async getStudentData(assignments: Assignment[], powerupTypes: PowerupType[], taskRequirement: number) : Promise<StudentData> {
        let requestURL = this.BASE_URL +`player`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include"
        });
        let _data = await res.json();
        if(_data.success) {
            let data = _data.data;

            let studentData: StudentData = {
                student: data.student,
                tokens: data.tokens,
                points: this.mapPoints(data),
                unusedPowerups: this.mapUnusedPowerupData(data.powerups, powerupTypes),
                assignmentsData: await this.mapAssignmentDetails(data, assignments, powerupTypes, taskRequirement)
            }
            return Promise.resolve(studentData);
        }
        else throw _data.message;
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
        if(data.length == 0) return [];
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
        if(data.length == 0) return [];
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

    private async mapAssignmentDetails(data : any, assignmentsData: Assignment[], powerupTypes: PowerupType[], taskRequirement: number): Promise<AssignmentDetails[]> {
        let assignments: AssignmentDetails[] = [];
        assignmentsData = assignmentsData.filter( (x) => { return x.active;});
        for(const assignment of assignmentsData) {
            let index = data.assignmentProgress.findIndex( (x: any) => { return x.assignment_id == assignment.id; } );
            if(index != -1) {
                let _index = data.currentTasks.findIndex( (x: any) => { return x.assignment_id == assignment.id; } );
                let _pIndex = data.assignmentPoints.findIndex( (x: any) => { return x.assignment_id == assignment.id; });
                let _ffIndex = data.completedTasks.findIndex( (x: any) => { return x.assignment_id == assignment.id; });
                let _tiIndex = data.turnedInTasks.findIndex( (x: any) => { return x.assignment_id == assignment.id; });
                let powerupsUsedData = this.mapUsedPowerupData(data.powerups, powerupTypes, assignment.id);
                let hint = "";
                let previousPoints = -1;
                if(_index != -1) {
                    let _tnIndex = powerupsUsedData.findIndex( (x: any) => { return x.name == 'Hint' && x.taskNumber == data.currentTasks[_index].task_number });
                    if(_tnIndex != -1) {
                        let hintResponse = await this.getUsedHint(assignment.id, data.currentTasks[_index].task_number);
                        if(hintResponse.success)
                            hint = hintResponse.data.hint;
                        else throw hintResponse.message;
                    }
                    let _scIndex = powerupsUsedData.findIndex( (x: any) => { return x.name == 'Second Chance' && x.taskNumber == data.currentTasks[_index].task_number });
                    if(_scIndex != -1) {
                        // Refactor this! This is stupid
                        let previousPointsResponse = await this.getPreviousPoints(assignment.id, data.currentTasks[_index].task_number);
                        if(previousPointsResponse.success)
                            previousPoints = previousPointsResponse.data.points;
                        else throw previousPointsResponse.message;
                    }
                }
                let _assignmentDetails : AssignmentDetails = {
                    id: assignment.id,
                    name: assignment.name,
                    path: assignment.path,
                    unlocked: true,
                    started: true,
                    finished: data.assignmentProgress[index].status == "Completed",
                    tasksFullyFinished: (_ffIndex != -1) ? parseInt(data.completedTasks[_ffIndex].completed) : 0,
                    tasksTurnedIn: (_tiIndex != -1) ? parseInt(data.turnedInTasks[_tiIndex].turned_in) : 0,
                    previousPoints: previousPoints,
                    points: (_pIndex != -1) ? data.assignmentPoints[_pIndex].points : 0,
                    currentTask: (_index == -1) ? {name:"Loading", taskNumber: -1} : {
                        name: data.currentTasks[_index].task_name,
                        taskNumber: data.currentTasks[_index].task_number
                    },
                    taskHint: hint,
                    buyingPowerUp: false,
                    powerupsUsed : powerupsUsedData,
                    collapsed: false,
                    assignmentTime: data.assignmentProgress[index].total_time,
                    taskTime: (_index == -1) ? 0 : data.currentTasks[_index].total_time
                }
                assignments.push(_assignmentDetails);
            } else {
                let _assignmentDetails : AssignmentDetails = {
                    id: assignment.id,
                    name: assignment.name,
                    path: assignment.path,
                    unlocked: false,
                    started: false,
                    finished: false,
                    tasksFullyFinished: 0,
                    tasksTurnedIn: 0,
                    previousPoints: -1,
                    points: 0,
                    currentTask: {name:"Loading", taskNumber: -1},
                    taskHint: "",
                    buyingPowerUp: false,
                    powerupsUsed: [],
                    collapsed: false,
                    assignmentTime: 0,
                    taskTime: 0
                }
                assignments.push(_assignmentDetails);
            }
        }
        assignments[0].unlocked = true;
        for(let i=1;i<assignments.length;i++)
            assignments[i].unlocked = (assignments[i-1].tasksFullyFinished >= taskRequirement);
        assignments.sort( (a,b) => a.id - b.id );
        return assignments;
    }


    public async getPreviousPoints(assignment_id : number, taskNumber: number) : Promise<ServerResponse> {
        let requestURL = this.BASE_URL + `${assignment_id}/task/${taskNumber}`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include",
        });
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data, res.status));
    }

    public async buyPowerup(powerupType: PowerupType) : Promise<ServerResponseV11> {
        let requestURL = this.BASE_URL + `buy_powerup?type=${powerupType.id}`;
        let res = await fetch(requestURL, {
            method: "POST",
            credentials: "include",
            headers: {
                'Content-Type': 'application/json'
            }
        })
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data, res.status));
    }

    public async startAssignment(assignment: AssignmentDetails) : Promise<ServerResponseV11> {
        let requestURL = this.BASE_URL +`${assignment.id}/start`;
        let res = await fetch(requestURL, {
            method: "POST",
            credentials: "include",
            headers: {
                'Content-Type': 'application/json'
            }
        });
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data, res.status));
    }

    public async getSecondChanceAvailableTasks(assignment: AssignmentDetails, type_id: number) : Promise<ServerResponseV11> {
        let requestURL = this.BASE_URL +`${assignment.id}/second_chance_tasks`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include"
        });
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data, res.status));
    }

    public async useSecondChance(assignment: AssignmentDetails, task: Task) : Promise<ServerResponseV11> {
        let requestURL = this.BASE_URL + `${assignment.id}/second_chance`;
        let res = await fetch(requestURL, {
            method: "POST",
            credentials: "include",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                task_number: task.taskNumber
            })
        });
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data, res.status));
    }

    public async useHint(assignment: AssignmentDetails) : Promise<ServerResponseV11> {
        let requestURL = this.BASE_URL + `${assignment.id}/hint`;
        let res = await fetch(requestURL, {
            method: "POST",
            credentials: "include",
            headers: {
                'Content-Type': 'application/json'
            }
        });
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data, res.status));
    }

    public async getUsedHint(assignment_id : number, taskNumber: number) : Promise<ServerResponseV11> {
        let requestURL = this.BASE_URL + `${assignment_id}/used_hint?task_number=${taskNumber}`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include",
        });
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data, res.status));
    }

    public async useSwitchTask(assignment: AssignmentDetails) : Promise<ServerResponseV11> {
        let requestURL = this.BASE_URL + `${assignment.id}/switch_task`;
        let res = await fetch(requestURL, {
            method: "POST",
            credentials: "include",
            headers: {
                'Content-Type': 'application/json'
            }
        });
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data, res.status));
    }

    public async turnInTask(assignment: AssignmentDetails) : Promise<ServerResponseV11> {
        let testData = { task_time : assignment.taskTime };
        let requestURL = this.BASE_URL + `${assignment.id}/turn_in`;
        let res = await fetch(requestURL, {
            method: "POST",
            credentials: "include",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data, res.status));
    }

    public async restoreTask(assignment: AssignmentDetails) : Promise<ServerResponseV11> {
        let requestURL = this.BASE_URL + `${assignment.id}/restore`;
        let res = await fetch(requestURL, {
            method: "POST",
            credentials: "include",
            headers: {
                'Content-Type': 'application/json'
            }
        });
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data, res.status));
    }

    public async updateTaskTime(assignment: AssignmentDetails) : Promise<ServerResponseV11> {
        let testData = { task_time : assignment.taskTime };
        let requestURL = this.BASE_URL + `${assignment.id}/update_time`;
        let res = await fetch(requestURL, {
            method: "POST",
            credentials: "include",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data, res.status));
    }
}
