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

@injectable()
export class GameService {
    
    private BASE_URL = "http://34.69.254.181/services/uup_game.php?action="

    public async getAssignments() : Promise<Assignment[]> {
        /*let requestURL = this.BASE_URL +`getAssignments`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include"
        });
        let data = await res.json();
        return Promise.resolve(data.data);*/
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
        let requestURL = this.BASE_URL +`getPowerUpTypes`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include"
        });
        let data = await res.json();
        console.log("Powerup type data received: " + JSON.stringify(data));
        return Promise.resolve(data.data);
    }

    public async getChallengeConfig() : Promise<ChallengeConfig> {
        let requestURL = this.BASE_URL +`getChallengeConfig`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include"
        });
        let data = await res.json();
        console.log("Challenge cfg data received: " + JSON.stringify(data));
        return Promise.resolve(data.data);
    }

    public async getTaskCategories() : Promise<TaskCategory[]> {
        let requestURL = this.BASE_URL +`getTaskCategories`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include"
        });
        let data = await res.json();
        console.log("Task Categories data received: " + JSON.stringify(data));
        return Promise.resolve(data.data);
    }

    private async delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private mapResponse(serverResponse: any) : ServerResponse  {
        let response = {
            success: false,
            message: "",
            data: {}
        };
        if(!serverResponse.success) 
            return {
                success: false,
                message: serverResponse.message,
                data: {}
            }
        if(!!serverResponse && !serverResponse.reason) {
            response.success = false;
            response.message = serverResponse.data.reason;
            response.data = {};
        } else {
            response.success = true;
            response.message = serverResponse.message;
            response.data = serverResponse.data;
        }
        return response;
    }

    public async buyPowerup(powerupType: PowerupType) : Promise<PowerupResponse> {
        let powerupResponse = {
            success: false,
            message: "",
            powerupType: "1",
            price: 0,
            tokens: 0
        };
        await this.delay(5000).then( ()=> {
            powerupResponse = {
                "success": true,
                "message": "Powerup added to student mmesihovic1",
                "powerupType": "1",
                "price": 60,
                "tokens": 75
            };
        });   
        /*let requestURL = this.BASE_URL + `buyPowerUp&type_id=${powerupType.id}`;
        let res = await fetch(requestURL, {
            method: "POST",
            credentials: "include",
            headers: {
                'Content-Type': 'application/json'
            }
        })
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data));*/
        return Promise.resolve(powerupResponse); 
    }

    public async startAssignment(assignment: AssignmentDetails) : Promise<ServerResponse> {
        /*let requestURL = this.BASE_URL +`startAssignment&assignment_id=${assignment.id}`;
        let res = await fetch(requestURL, {
            method: "POST",
            credentials: "include",
            headers: {
                'Content-Type': 'application/json'
            }
        });
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data));*/
        return Promise.resolve({
            success: true,
            message: "Assignment successfully started.",
            data: {
                "message": "Assignment successfully started.",
                "taskData": {
                    "task_number": 1,
                    "task_name": "Task 260"
                }
            }
        });
    } 

    public async useHint(assignment: AssignmentDetails) : Promise<ServerResponse> {
        let hintResponse = {
            success: false,
            message: "",
            data: {}
        }
        await this.delay(5000).then( () => {
            hintResponse = {
                success: true,
                message: "nije bitno",
                data: {
                    hint: "Testni hint za neki zadatak",
                    tokens: 70,
                }
            };
        });
        /*
        let requestURL = this.BASE_URL + `hint&assignment_id=${assignment.id}`;
        let res = await fetch(requestURL, {
            method: "POST",
            credentials: "include",
            headers: {
                'Content-Type': 'application/json'
            }
        });
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data));
        */
        return Promise.resolve(hintResponse);
    }

    public async useSecondChance(assignment: AssignmentDetails, task: Task) : Promise<ServerResponse> {
        let secondChanceResponse = {
            success: false,
            message: "",
            data: {
                task_name: "",
                task_number: 0,
                previous_points: -1
            } 
        }
        await this.delay(5000).then( () => {
            secondChanceResponse = {
                success: true,
                message: "Second chance uspio",
                data: {
                    task_name: "Testni zadatak 3",
                    task_number: 3,
                    previous_points: 0.15
                }
            };
        });
        /*
        let requestURL = this.BASE_URL + `secondChance&assignment_id=${assignment.id}`;
        let res = await fetch(requestURL, {
            method: "POST",
            credentials: "include",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                task_name: task.name,
                task_number: task.taskNumber
            })
        });
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data));
        */
        return Promise.resolve(secondChanceResponse);
       
    }

    public async switchTask(assignment: AssignmentDetails) : Promise<ServerResponse> {
        let requestURL = this.BASE_URL + `swapTask&assignment_id=${assignment.id}`;
        let res = await fetch(requestURL, {
            method: "POST",
            credentials: "include",
            headers: {
                'Content-Type': 'application/json'
            }
        });
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data));
    }

    public async turnInTask(assignment: AssignmentDetails, testData: {total_tests: number; passed_tests: number}) : Promise<ServerResponse> {
        /*
        let requestURL = this.BASE_URL + `turnTaskIn&assignment_id=${assignment.id}`;
        let res = await fetch(requestURL, {
            method: "POST",
            credentials: "include",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        let data = await res.json();
        return Promise.resolve(this.mapResponse(data));
        */
        return Promise.resolve({
            success:true,
            message: "Current task for student mmesihovic1 in given assignment has been been turned in successfully.",
            data:  {
                "assignmentDone": false,
                "points": 0.2,
                "tokens": 20,
                "additionalTokens": {},
                "taskData": {
                    "task_number": 234,
                    "task_name": "Assignment finished"
                }
            }
        })
    }

    public async getSecondChanceAvailableTasks(assignment: AssignmentDetails, type_id: number) : Promise<Task[]> {
        /*let requestURL = this.BASE_URL +`getAvailableTasks&assignment_id=${assignment.id}&type_id=${type_id}`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include"
        });
        let data = await res.json();
        return Promise.resolve(data.data);*/
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

    public async getUsedHint(assignment_id : number, taskNumber: number) : Promise<string> {

        /*let requestURL = this.BASE_URL + `getUsedHint&assignment_id=${assignment.id}&task_number=${assignment.currentTask.taskNumber}`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include",
        });
        let data = await res.json();
        return Promise.resolve(data.data.hint); */
        return Promise.resolve("Neki testni hint koji sam vec koristio");
    }

    public async getPreviousPoints(assignment_id : number, taskNumber: number) : Promise<number> {
        /*let requestURL = this.BASE_URL + `getTaskPreviousPoints&assignment_id=${assignment.id}&task_number=${assignment.currentTask.taskNumber}`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include",
        });
        let data = await res.json();
        return Promise.resolve(data.data.points); */
        return Promise.resolve(0.15);
    }

    public async getStudentData(assignments: Assignment[], powerupTypes: PowerupType[], taskRequirement: number) : Promise<StudentData> {
        /*let requestURL = this.BASE_URL +`getStudentData`;
        let res = await fetch(requestURL, {
            method: "GET",
            credentials: "include"
        });
        let data = await res.json();
        data = data.data*/
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
                    "used": true,
                    "assignment_id": 2,
                    "task_number": 9
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
                    "completed": "4"
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
            assignmentsData: await this.mapAssignmentDetails(data, assignments, powerupTypes, taskRequirement)
        }
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
                        //Posalji request da dobijes hint
                        let usedHint = await this.getUsedHint(assignment.id, data.currentTasks[_index].task_number);
                        hint = usedHint;
                    }
                    let _scIndex = powerupsUsedData.findIndex( (x: any) => { return x.name == 'Second Chance' && x.taskNumber == data.currentTasks[_index].task_number });
                    if(_scIndex != -1) {
                        //Posalji request da dobijes previous poene
                        let _previousPoints = await this.getPreviousPoints(assignment.id, data.currentTasks[_index].task_number);
                        previousPoints = _previousPoints;
                    }
                }
                let _assignmentDetails : AssignmentDetails = {
                    id: assignment.id,
                    name: assignment.name,
                    unlocked: true,
                    started: true,
                    finished: data.assignmentProgress[index].status == "Completed",
                    tasksFullyFinished: parseInt(data.completedTasks[_ffIndex].completed),
                    tasksTurnedIn: parseInt(data.turnedInTasks[_tiIndex].turned_in),
                    previousPoints: previousPoints,
                    points: data.assignmentPoints[_pIndex].points,
                    currentTask: (_index == -1) ? {name:"Loading", taskNumber: -1} : {
                        name: data.currentTasks[_index].task_name,
                        taskNumber: data.currentTasks[_index].task_number
                    },
                    taskHint: hint,
                    buyingPowerUp: false,
                    powerupsUsed : powerupsUsedData,
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
                    previousPoints: -1,
                    points: 0,
                    currentTask: {name:"Loading", taskNumber: -1},
                    taskHint: "",
                    buyingPowerUp: false,
                    powerupsUsed: [],
                    collapsed: false
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

}
