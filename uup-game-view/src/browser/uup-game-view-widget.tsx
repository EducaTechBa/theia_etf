import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { Assignment, PowerupType, StudentData, GameService, ChallengeConfig, AssignmentDetails, TaskCategory, UsedPowerup, CourseInfo} from './uup-game-service';
import { ConfirmDialog } from '@theia/core/lib/browser';
import { SelectDialog } from './select-dialogue';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { AutotestService, AutotestEvent } from 'autotest-view/lib/browser/autotest-service';


interface GameInformationState {
    handlers: Record<string, boolean>
    storeOpen: boolean;
    buyingPowerup: boolean;
    assignments: Assignment[];
    powerupTypes: PowerupType[];
    taskCategories: TaskCategory[];
    challengeConfig: ChallengeConfig;
    studentData: StudentData;
}

@injectable()
export class UupGameViewWidget extends ReactWidget {

    static readonly ID = 'uup-game-view:widget';
    static readonly LABEL = 'UUP Game';

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @inject(FileService)
    protected readonly fileService!: FileService;

    @inject(GameService)
    protected readonly gameService!: GameService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(AutotestService)
    protected readonly autotestService: AutotestService;

    private state: GameInformationState = {
        handlers: {},
        storeOpen: false,
        buyingPowerup: false,
        assignments: [],
        powerupTypes: [],
        taskCategories: [],
        challengeConfig: {
            enoughPoints: 0,
            noPowerups: 0,
            maxPoints: 0,
            maxPointsNoPowerups: 0,
            tasksRequired: 0
        },
        studentData: {
            student: "",
            tokens: 0,
            points: 0,
            unusedPowerups: [],
            assignmentsData: []
        }
    }

    private studentCheck = false;

    @postConstruct()
    protected async init(): Promise < void> {
        this.id = UupGameViewWidget.ID;
        this.title.label = UupGameViewWidget.LABEL;
        this.title.caption = UupGameViewWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-gamepad'; // Gamepad Icon

        const courses = await this.getStudentCoursesInfo();
        for(const course of courses) {
            if(course.abbrev==='UUP' || course.abbrev==='OR') {
                this.studentCheck = true;
                break;
            }
        }

        if(this.studentCheck) {
            const _initialState = await this.initializeGameInformationState();

            this.setState(state => {
                state.handlers = _initialState.handlers;
                state.assignments = _initialState.assignments,
                state.powerupTypes = _initialState.powerupTypes,
                state.challengeConfig = _initialState.challengeConfig,
                state.taskCategories = _initialState.taskCategories,
                state.studentData =  _initialState.studentData
            });
        }

        this.update();
    }

    private async initializeGameInformationState() : Promise<GameInformationState> {
        const directoryExists = await this.workspaceService.containsSome(['UUP_GAME']);
        const workspaceURI = this.workspaceService.workspace?.resource || '';
        const gameDirectoryURI = `${workspaceURI}/UUP_GAME`;
        if(!directoryExists)
            await this.fileService.createFolder(new URI(gameDirectoryURI));

        const _assignments = await this.gameService.getAssignments();
        const _powerupTypes = await this.gameService.getPowerupTypes();
        const _challengeConfig = await this.gameService.getChallengeConfig();
        const _taskCategories = await this.gameService.getTaskCategories();
        const _studentData = await this.gameService.getStudentData(_assignments, _powerupTypes, _challengeConfig.tasksRequired);
        const _handlers = this.generateEmptyHandlers(_assignments);
        return {
            storeOpen: false,
            buyingPowerup: false,
            handlers: _handlers,
            assignments: _assignments,
            powerupTypes: _powerupTypes,
            challengeConfig: _challengeConfig,
            taskCategories: _taskCategories,
            studentData: _studentData
        }
    }

    private setState(update: (state: GameInformationState) => void) {
        update(this.state);
        this.update();
    }

    private async getStudentCoursesInfo(): Promise<CourseInfo[]> {
        const url = '/assignment/ws.php?action=courses';
        const res = await fetch(url, {
            credentials: 'include'
        });

        const json = await res.json();

        return json.data.map((course: any) => ({
            id: course.id,
            name: course.name,
            abbrev: course.abbrev,
            external: course.external,
        }));
    }

    private generateEmptyHandlers(assignments: Assignment[]) : Record<string, boolean> {
        assignments = assignments.filter( (x) => { return x.active;});
        let handlers : Record<string,boolean> = {};
        assignments.forEach( (x: Assignment) => { handlers[x.name] = false; })
        return handlers;
    }

    private getPowerupAmount(powerupName: string) : number {
        let amount = 0;
        this.state.studentData?.unusedPowerups.forEach( (x: any) => {
            if(x.name == powerupName) {
                amount = x.amount;
            }
        })
        return amount;
    }
    
    private collapseAssignment(assignment_id: number) {
        this.state.studentData?.assignmentsData.forEach( (x: AssignmentDetails) => {
            if(x.id==assignment_id)
                x.collapsed = !x.collapsed;
        });
        this.setState(state => {
            state.studentData = this.state.studentData;
        });
    }

    private collapsePowerupStore() {
        this.setState(state => {
            state.storeOpen = !this.state.storeOpen;
        });
    }

    private updateAssignmentState(assignment: AssignmentDetails) {
        const index = this.state.studentData.assignmentsData.findIndex( x => x.id == assignment.id);
        if(index == -1)
            return;
        this.state.studentData.assignmentsData[index] = assignment;
        this.setState(state => {
            state.studentData = this.state.studentData;
        });
    }

    //Testirati
    private async buyPowerup(powerupType: PowerupType) {
        //Confirmation window
        const dialog = new ConfirmDialog({
            title: 'Buy power-up confirmation',
            maxWidth: 500,
            msg: `Are you sure you want to trade ${powerupType.price} tokens for power-up '${powerupType.name}'?`,
            ok: "Yes",
            cancel: "No"
        });
        const confirmation = await dialog.open();
        if(confirmation) {
            this.messageService.info(`Buying power-up '${powerupType.name}' for ${powerupType.price} tokens.`);
            this.setState(state => {
                state.buyingPowerup = true;
            });
            const response = await this.gameService.buyPowerup(powerupType);
            if(response.success) {
                this.messageService.info(`Powerup '${powerupType.name}' successfully bought.`);
                const index = this.state.studentData?.unusedPowerups.findIndex( (x: any) => { return x.name == powerupType.name; });
                if(index == -1)
                    this.state.studentData?.unusedPowerups.push({name: powerupType.name, amount: 1});
                else {
                    this.state.studentData?.unusedPowerups.forEach( (x: any) => {
                        if(x.name == powerupType.name)
                            x.amount += 1;
                    });
                }
                this.state.studentData.tokens = response.tokens;
            } else {
                this.messageService.error(`Buying power-up failed.`);
            }
            this.setState(state => {
                state.buyingPowerup = false;
                state.studentData = this.state.studentData;
            });
        }
    }
    //Testirati
    // TODO: dodati otvaranje postavki i odgovarajucih fajlova nakon file switch-a
    // pogledati brisanje fajlova.
    private async startAssignment(assignment: AssignmentDetails) {
        const dialog = new ConfirmDialog({
            title: 'Start assignment confirmation',
            maxWidth: 500,
            msg: `Are you sure you want to start assigment '${assignment.name}'?`,
            ok: "Yes",
            cancel: "No"
        });
        const confirmation = await dialog.open();
        if(!confirmation)
            return;

        const directoryExists = await this.workspaceService.containsSome([`UUP_GAME/${assignment.name}`]);
        const workspaceURI = this.workspaceService.workspace?.resource || '';
        const assignmentDirectoryURI = `${workspaceURI}/UUP_GAME/${assignment.name}`;
        //Create directory if it does not exist
        if (!directoryExists) {
            await this.fileService.createFolder(new URI(assignmentDirectoryURI));
        }  
        //Call service to start asssignment and get a response
        const response = await this.gameService.startAssignment(assignment);
        if(!response.success) {
            this.messageService.error(response.message);
        } else {             
            //Update assignment i update state
            assignment.started = true;
            assignment.finished = false;
            assignment.currentTask = {
                name: response.data.taskData.task_name,
                taskNumber: response.data.taskData.task_number
            }
            this.updateAssignmentState(assignment);
            //Otvoriti nove fajlove
        }        
    }
    
    //Testirati
    private async useHintPowerup(assignment: AssignmentDetails) {
        const dialog = new ConfirmDialog({
            title: "Use power-up confirmation",
            maxWidth: 500,
            msg: `Are you sure you want to use powerup 'Hint' on current task in this assignment?
            This hint will be permanently visible while you are working on this task,
            even if you return to it using power-up 'Second Chance'.`,
            ok: "Yes",
            cancel: "No"
        });
        const confirmation = await dialog.open();
        if(confirmation) {
            this.messageService.info(`Using power-up hint for current task.`);
            this.setState(state => {
                let index = state.studentData.assignmentsData.findIndex( x => x.id == assignment.id );
                if(index != -1)
                    state.studentData.assignmentsData[index].buyingPowerUp = true;
            });
            const response = await this.gameService.useHint(assignment);
            if(response.success) {
                this.messageService.info(`Power-up 'Hint' has been used successfully.`);
                this.messageService.info(`Hint: ${response.data.hint}`);
                let hint = response.data.hint;
                const index = this.state.studentData?.unusedPowerups.findIndex( (x: any) => { return x.name == 'Hint'; });
                this.state.studentData.unusedPowerups[index].amount -= 1;
                //Update assignmentDetails
                assignment.taskHint = hint;
                assignment.powerupsUsed.push({name: "Hint", taskNumber: assignment.currentTask.taskNumber});
                this.updateAssignmentState(assignment);
            } else {
                this.messageService.error(`Using power-up 'Hint' failed.`);
            }
            this.setState(state => {
                let index = state.studentData.assignmentsData.findIndex( x => x.id == assignment.id );
                if(index != -1)
                    state.studentData.assignmentsData[index].buyingPowerUp = false;
            });
        }

    }

    //Testirati
    //TODO: 
    // zatvoriti i otvoriti fajlove u editoru.
    private async useSecondChancePowerup(assignment: AssignmentDetails) {
        const scPowerup = this.state.powerupTypes.find( (x: PowerupType) => x.name == 'Second Chance');
        let type_id = -1;
        if(!!scPowerup)
            type_id = scPowerup.id;
        const tasks = await this.gameService.getSecondChanceAvailableTasks(assignment, type_id);
        if(tasks.length === 0) {
            this.messageService.error(`You do not have any available task to go back to. This error only occurs
                                       if you have completed all tasks in assignment with all tests successful or
                                       if you have already used this power-up on all tasks that haven't been completed
                                       successfully. You can only return to specific task once!`);
            return;
        }
        const result = await new SelectDialog({
            items: tasks,
            label: task => `${task.taskNumber}. ${task.name}`,
            title: 'Use power-up confirmation',
            maxWidth: 500,
            message: `Are you sure you want to use 'Second Chance' power up?
You can only return to tasks you haven't fully finished. All 
progress on current task will be saved. You can only return to 
specific task once, if you make changes you need to turn it in
before using this power-up again, else all progress will be lost. Below is a list of tasks with
second chance available, choose wisely!`
        }).open();
        if(!result) 
            return;    
        this.messageService.info(`Using power-up second chance. Returning to task ${result.name}.`);
        this.setState(state => {
            let index = state.studentData.assignmentsData.findIndex( x => x.id == assignment.id );
            if(index != -1)
                state.studentData.assignmentsData[index].buyingPowerUp = true;
        });
        let createdFolders = false;
        //If assignment is already finished, we need to regenerate folders for it
        if(assignment.finished) {
            this.messageService.info(`Using 'Second Chance' power-up on finished assignment detected. Regenerating required resources.`);
            this.generateAssignmentFiles(assignment);
            createdFolders = true;
        }
        const response = await this.gameService.useSecondChance(assignment, result);
        if(response.success) {
            this.messageService.info(`Power-up 'Second Chance' has been used sucessfully.`);
            this.messageService.info(`You are now back to task ${response.data.task_name} [Task ${response.data.task_number}].`);
            const index = this.state.studentData?.unusedPowerups.findIndex( (x: any) => { return x.name == 'Second Chance'; });
            this.state.studentData.unusedPowerups[index].amount -= 1;
            //Update current task
            assignment.currentTask = {
                name: response.data.task_name,
                taskNumber: response.data.task_number
            };
            //Set previous points in assignments state
            assignment.previousPoints = response.data.previous_points;
            //Update hint if existing
            assignment.taskHint = "";
            assignment.powerupsUsed.push({name: "Second Chance", taskNumber: assignment.currentTask.taskNumber});
            const pIndex = assignment.powerupsUsed.findIndex( (x: any) => { return x.name == 'Hint' && x.taskNumber == assignment.currentTask.taskNumber });
            if( pIndex != -1) {
                assignment.taskHint = await this.gameService.getUsedHint(assignment.id, assignment.currentTask.taskNumber);
            }
            if(assignment.finished) {
                assignment.started = true;
                assignment.finished = false;
            }
        } else {
            this.messageService.error(response.message);
            if(createdFolders) {
                this.removeAssignmentFiles(assignment);
            }
        }
        this.setState(state => {
            let index = state.studentData.assignmentsData.findIndex( x => x.id == assignment.id );
            if(index != -1) {
                state.studentData.assignmentsData[index].buyingPowerUp = false;
            }
            state.studentData.assignmentsData[index] = assignment;
        });
    }

    //Testirati
    // TODO: 
    // ZATVORI sve fajlove otvorene iz current open tabs
    // Otvori nove nakon responsea
    private async useSwitchTaskPowerup(assignment: AssignmentDetails) {
        const dialog = new ConfirmDialog({
            title: "Use power-up confirmation",
            maxWidth: 500,
            msg: `Are you sure you want to use powerup 'Switch Task' on current task in this assignment?
            This will result in new task being selected from tasks database and assigned to you.`,
            ok: "Yes",
            cancel: "No"
        });
        const confirmation = await dialog.open();
        if(confirmation) {
            this.messageService.info(`Using power-up 'Switch Task' for current task.`);
            this.setState(state => {
                let index = state.studentData.assignmentsData.findIndex( x => x.id == assignment.id );
                if(index != -1)
                    state.studentData.assignmentsData[index].buyingPowerUp = true;
            });
            const response = await this.gameService.switchTask(assignment);
            if(response.success) {
                this.messageService.info(`Power-up 'Switch Task' has been used successfully. New task files are now in your workspace. Good luck!`);
                const index = this.state.studentData?.unusedPowerups.findIndex( (x: any) => { return x.name == 'Switch Task'; });
                this.state.studentData.unusedPowerups[index].amount -= 1;
                //Update current assignment
                assignment.powerupsUsed.push({name: "Switch Task", taskNumber: assignment.currentTask.taskNumber}); 
                assignment.currentTask = {
                    name: response.data.taskData.task_name,
                    taskNumber: response.data.taskData.task_number
                }
                assignment.previousPoints = -1;
                assignment.taskHint = "";
                this.updateAssignmentState(assignment);
            } else {
                this.messageService.error(response.message);
            }
            this.setState(state => {
                let index = state.studentData.assignmentsData.findIndex( x => x.id == assignment.id );
                if(index != -1)
                    state.studentData.assignmentsData[index].buyingPowerUp = false;
            });
        }

    }

    private async generateAssignmentFiles(assignment: AssignmentDetails) {
        const directoryExists = await this.workspaceService.containsSome([`UUP_GAME/${assignment.name}`]);
        const workspaceURI = this.workspaceService.workspace?.resource || '';
        const assignmentDirectoryURI = `${workspaceURI}/UUP_GAME/${assignment.name}`;

        if (!directoryExists) {
            await this.fileService.createFolder(new URI(assignmentDirectoryURI));
        }
    }

    private async removeAssignmentFiles(assignment: AssignmentDetails) {
        const directoryExists = await this.workspaceService.containsSome([`UUP_GAME/${assignment.name}`]);
        const workspaceURI = this.workspaceService.workspace?.resource || '';
        const assignmentDirectoryURI = `${workspaceURI}/UUP_GAME/${assignment.name}`;

        if (directoryExists) {
            await this.fileService.delete(new URI(assignmentDirectoryURI), { recursive:true });
        }
    }

    private unlockNextAssignment(assignment: AssignmentDetails) {
        let index = this.state.studentData.assignmentsData.findIndex( (x: AssignmentDetails) => x.id == assignment.id);
        if(index == this.state.studentData.assignmentsData.length-1)
            return;
        this.state.studentData.assignmentsData[index+1].unlocked = true;
    }

    //TODO:
    // zatvoriti i otvoriti fajlove
    // dodati check da li je user invoked testiranje bilo ili ne
      //Hoce li praviti problem kad se second chance vrati 
    private async turnInCurrentTask(assignment: AssignmentDetails) {
        const workspaceURI = this.workspaceService.workspace?.resource || '';
        const assignmentDirectoryURI = `${workspaceURI}/UUP_GAME/${assignment.name}`;
        //const assignmentDirectoryURI = `${workspaceURI}/UUP/T2/Z2`;

        const dialog = new ConfirmDialog({
            title: "Task turn in confirmation",
            maxWidth: 500,
            msg: `Are you sure you want to turn in current task in this assignment?
            This action will automatically close tabs related to this task and run tests on current task. Testing
            can last a while depending on server load. While this action lasts, you can work on another assignment
            or wait for notification that task has been turned in successfully and work on a new task. Task description
            will be opened in new tab.`,
            ok: "Yes",
            cancel: "No"
        });
        const confirmation = await dialog.open();
        if(confirmation) {
            this.setState(state => {
                let index = state.studentData.assignmentsData.findIndex( x => x.id == assignment.id );
                if(index != -1)
                    state.studentData.assignmentsData[index].buyingPowerUp = true;
            });
            // Start testing
            this.messageService.info(`Starting unit testing on task '${assignment.currentTask.name}'.`);
            this.autotestService.runTests(assignmentDirectoryURI, false);
            console.log("Checkpoint: Started runTests method");
            //Da li ce ovo praviti problem kod second chancea??
            let check = this.state.handlers[assignment.name];
            if(!check) {
                this.state.handlers[assignment.name] = true;
                this.autotestService.onTestsFinished( async (e: AutotestEvent) => {
                    //TODO: dodati user invoked.
                    if(e.program.isUserInvoked || e.program.uri !== assignmentDirectoryURI)
                        return;
                    console.log("OnTestsFinished fired: ", assignmentDirectoryURI);
                    let tpResults = await this.autotestService.getTestPassResults(assignmentDirectoryURI);
                    let results = {
                        "passed_tests": tpResults.passed,
                        "total_tests": tpResults.total
                    }
                    console.log(JSON.stringify(results));
                    //Testing purposes
                    results = {
                        "passed_tests": 3,
                        "total_tests": 3
                    }
                    const _dialog = new ConfirmDialog({
                        title: "Task turn in confirmation",
                        maxWidth: 500,
                        msg: `Testing task '${assignment.currentTask.name}' has
                        been completed.\n Successful tests: ${results.passed_tests}\n Total tests: ${results.total_tests}\n
                        Are you sure you want to turn in this task?`,
                        ok: "Yes",
                        cancel: "No"
                    });
                    const _confirmation = await _dialog.open();
                    if(!_confirmation) {
                        this.setState(state => {
                            let index = state.studentData.assignmentsData.findIndex( x => x.id == assignment.id );
                            if(index != -1)
                                state.studentData.assignmentsData[index].buyingPowerUp = false;
                        });
                        return;
                    }
                    const response = await this.gameService.turnInTask(assignment, results);
                    if(response.success) {
                        this.messageService.info(response.message);
                        assignment.tasksTurnedIn += 1;
                        //Update assignment and set state
                        assignment.currentTask = {
                            name: response.data.taskData.task_name,
                            taskNumber: response.data.taskData.task_number
                        };
                        if(results.passed_tests === results.total_tests) {
                            assignment.tasksFullyFinished += 1;
                            if(this.state.challengeConfig.tasksRequired-assignment.tasksFullyFinished > 0) 
                                this.messageService.warn(`You need to complete ${this.state.challengeConfig.tasksRequired-assignment.tasksFullyFinished}
                                    more task${this.state.challengeConfig.tasksRequired-assignment.tasksFullyFinished==1?'':'s'}
                                    with all tests succeeded to unlock next assignment.Do not get locked out!`);
                            else this.unlockNextAssignment(assignment);
                        }
                        if(assignment.previousPoints != -1) {
                            this.state.studentData.points -= assignment.previousPoints;
                            assignment.points -= assignment.previousPoints;
                            assignment.previousPoints = -1;
                        }
                        assignment.points += response.data.points;
                        this.state.studentData.points += response.data.points;
                        this.state.studentData.tokens += response.data.tokens;
                        //Checking for additional tokens
                        let _additionalTokens = response.data.additionalTokens;
                        this.messageService.info(`You earned ${response.data.points*1000} XP and ${response.data.tokens} tokens.`);
                        if(Object.keys(_additionalTokens).length !== 0 && _additionalTokens.constructor === Object) {
                            this.messageService.info(`Congratulations! You earned additional ${_additionalTokens.amount} tokens.
                            Reason: ${_additionalTokens.reason}`)
                            this.state.studentData.tokens += _additionalTokens.amount;
                        }
                        if(response.data.assignmentDone) {
                            assignment.finished = true;
                            assignment.tasksTurnedIn = 15;
                            this.messageService.info(`Congratulations! You have completed all tasks in assignment '${assignment.name}.'`);
                            this.removeAssignmentFiles(assignment);
                        }
                        assignment.taskHint = "";
                        this.updateAssignmentState(assignment);
                    } else {
                        this.messageService.error(response.message);
                    }
                    // otvoriti novi task
                    this.setState(state => {
                        let index = state.studentData.assignmentsData.findIndex( x => x.id == assignment.id );
                        if(index != -1)
                            state.studentData.assignmentsData[index].buyingPowerUp = false;
                        state.studentData = this.state.studentData;
                    });
                });
            }
        }
       
     
    }

    private getTotalTasks() : number {
        let sum = 0;
        this.state.taskCategories.forEach( (x: TaskCategory) => { sum += x.tasks_per_category; });
        return sum;
    }
    
    private hasAlreadyUsedPowerup(name: string, assignment: AssignmentDetails) : boolean {
        let index = assignment.powerupsUsed.findIndex( (x: UsedPowerup) => x.name == name && x.taskNumber == assignment.currentTask.taskNumber );
        return index != -1;
    }
    
    protected render(): React.ReactNode {  
        let content;
        if(!this.studentCheck) {
            content = <div id='uup-game-container'>
                        <div style={{margin: "10px 10px 10px 10px !important"}}>{this.renderAlertBox('error', 'fa fa-times-circle', 'Access denied',
                                `You are not enrolled into course UUP or OR in current academic year.
                                If you think there has been a mistake contact your professor.`)}
                        </div>                          
                      </div>
        }
        else content = <div id='uup-game-container'>
                            {this.renderGeneralStudentInfo(this.state.studentData)}
                            <ul className="assignments-list">
                                <li>{this.renderPowerupStoreInfo()}</li>
                                {this.state.studentData?.assignmentsData.map(assignmentDetails => this.renderAssignmentDetails(assignmentDetails))}
                            </ul>
                        </div>
        return content;
    }

    private renderPowerupStoreInfo() : React.ReactNode {
        return <div className="powerup-store">
            <div className="theia-header header powerups-header"
                    onClick={() => { this.collapsePowerupStore() }}
                >
                    <span className={`theia-ExpansionToggle ${!this.state.storeOpen ? ' theia-mod-collapsed' : ''}`}></span>
                    <span className="label noselect">POWERUP STORE</span>
            </div>
            <div className={`collapse ${this.state.storeOpen ? ' in' : ''}`}>
                <div className="powerup-store-content">
                    <span style={{margin: '0px 0px 10px 0px'}}>Welcome to PowerUp store. Here you can exchange your tokens for power-ups.</span> 
                    <ul className="powerup-list">
                        {this.state.powerupTypes.map(powerupType => this.renderPowerupItem(powerupType))}
                    </ul>
                </div>
            </div>
        </div>
    }

    private renderPowerupItem(powerupType: PowerupType) : React.ReactNode {
        let iconClass;
        if(powerupType.name == 'Hint')
            iconClass = 'fa fa-lightbulb-o';
        else if(powerupType.name == 'Second Chance')
            iconClass = 'fa fa-undo';
        else iconClass = 'fa fa-exchange';
        return <li
            key={powerupType.id}
        >
            <span className="powerup-item">
                <span className="powerup-item-name">
                    <i className={`button-icon ${iconClass}`} aria-hidden="true"></i>
                    &nbsp;{powerupType.name}
                </span>
                <span>
                    <button 
                        disabled= { this.state.buyingPowerup || this.state.studentData.tokens < powerupType.price }
                        className="theia-button"
                        onClick={ () => {this.buyPowerup(powerupType)} }
                    >{powerupType.price}&nbsp;<i className="button-icon fa fa-cubes" aria-hidden="true"> </i></button>
                </span>

            </span>
        </li>
    }
    
    private renderGeneralStudentInfo(studentData?: StudentData) : React.ReactNode {
        const header = `Welcome ${this.state.studentData?.student}!` ;
        let points : number = this.state.studentData?.points || 0;
        let level = Math.floor(points) + 1;
        let progress : number = (points - Math.floor(points))*100;
        let xp = Math.floor(progress * 10);
        if(Math.abs(points - 30) < 0.0001 ) {
            level = 30;
            progress = 100;
            xp = 1000;
        }
        return <div className='student-info'>
            <span className="student-header">{header}</span>
            <span className="student-level">Level: {level}</span>
            <div className="progress-bar">
                    <span className="progress-bar-span">{progress.toFixed(2)}%</span>
                    <div className="progress-bar-xp" style={{width: `${progress.toFixed(2)}%`}}></div>
            </div>
            <span className="student-xp">XP: {xp}/1000</span>
            {this.renderPowerupStatus()}
        </div>
    }

    private renderPowerupStatus() : React.ReactNode {
        return <table className="powerups-table">
            <tbody>
                <tr>
                    <td><i className="fa fa-lightbulb-o" aria-hidden="true"></i></td>
                    <td><i className="fa fa-undo" aria-hidden="true"></i></td>
                    <td><i className="fa fa-exchange" aria-hidden="true"></i></td>
                    <td><i className="fa fa-cubes" aria-hidden="true"></i></td>
                </tr>
                <tr>
                    <td>{this.getPowerupAmount('Hint')}</td>
                    <td>{this.getPowerupAmount('Second Chance')}</td>
                    <td>{this.getPowerupAmount('Switch Task')}</td>
                    <td>{this.state.studentData?.tokens}</td>
                </tr>
            </tbody>
        </table>
    }  

    private renderAlertBox(type: string, icon: string, header: string, message: string) : React.ReactNode {

        return <div className='theia-alert-message-container' style={{padding: "10px 5px 0px 5px !important"}}>
            <div className={`theia-${type.toLowerCase()}-alert`}>
                <div className='theia-message-header'>
                    <i className={`${icon}`}></i>&nbsp;
                    {header}
                </div>
                <div className='theia-message-content' style={{padding: "5px 0px 0px 0px !important"}}>{message}</div>
            </div>
        </div>;
    
    }

    private renderAssignmentDetails(assignment: AssignmentDetails) : React.ReactNode {
        let content: React.ReactNode;
        if(!assignment.unlocked) {
            content = 
            <div className="assignment-locked">
                <span>You do not meet requirements to start this assignment.
                You need to complete atleast {this.state.challengeConfig?.tasksRequired} 
                &nbsp;tasks (all tests must be successful) from previous assignment
                in order to unlock this assignment.</span>
            </div>
        }
        else if(!assignment.started) {
            content =
            <div className="assignment-started">
                <span>You haven't started this assignment yet. Expand your knowledge
                by completing tasks, earning experience points and tokens which will
                allow you to buy power-ups to help you throughout the game.
                </span>
                <button 
                className="theia-button start-assignment-button"
                onClick = { () => {this.startAssignment(assignment)}}>
                    Start Assignment
                </button>
            </div>
        }
        else if(!assignment.finished) {
            let totalTasks = this.getTotalTasks();
            let percent = ((assignment.tasksTurnedIn/totalTasks)*100).toFixed(2);         
            content = 
            <div>
                <span className="assignment-progress">Assignment Progress</span>
                <div className="progress-bar">
                    <span className="progress-bar-span">{percent}%</span>
                    <div className="progress-bar-green" style={{width: `${percent}%`}}></div>
                </div>
                <div className="assignment-content">
                    <span className="span">Total tasks: {totalTasks}</span>
                    <span className="span">Tasks turned in: {assignment.tasksTurnedIn}</span>
                    <span className="span">Tasks fully finished: {assignment.tasksFullyFinished}</span>
                    <span className="span">Current task: {assignment.currentTask.taskNumber}</span>
                    <span className="span">Task name: {assignment.currentTask.name}</span> 
                    <div className={`collapse ${ assignment.tasksFullyFinished<this.state.challengeConfig.tasksRequired ? ' in' : ''}`}>
                        {this.renderAlertBox('warning', 'fa fa-exclamation-circle', 'Warning',
                        `You need to complete ${this.state.challengeConfig.tasksRequired-assignment.tasksFullyFinished}
                        more task${this.state.challengeConfig.tasksRequired-assignment.tasksFullyFinished==1?'':'s'}
                        with all tests succeeded to unlock next assignment.Do not get locked out!`)}
                    </div>
                    <div className={`collapse ${ assignment.taskHint != "" ? ' in' : ''}`}>
                        {this.renderAlertBox('info', 'fa fa-info-circle', 'Hint for current task', assignment.taskHint)}
                    </div>
                </div>
                <div className="powerups-buttons">
                    <button 
                        disabled= { assignment.buyingPowerUp || !(this.getPowerupAmount('Hint') > 0) || this.hasAlreadyUsedPowerup('Hint', assignment) }
                        className="theia-button powerup-button"
                         onClick={ () => {this.useHintPowerup(assignment)} }>
                        <i className="fa fa-lightbulb-o" aria-hidden="true"></i>
                    </button>
                    <button 
                        disabled= { assignment.buyingPowerUp || !(this.getPowerupAmount('Second Chance') > 0) }
                        className="theia-button powerup-button"
                        onClick = { () => {this.useSecondChancePowerup(assignment)} } >
                        <i className="fa fa-undo" aria-hidden="true"></i>
                    </button>
                    <button 
                        disabled= { assignment.buyingPowerUp || !(this.getPowerupAmount('Switch Task') > 0) || this.hasAlreadyUsedPowerup('Switch Task', assignment) }
                        className="theia-button powerup-button"
                        onClick = { () => {this.useSwitchTaskPowerup(assignment)} } >
                        <i className="fa fa-exchange" aria-hidden="true"></i>
                    </button>
                </div>
                <div className="powerups-buttons">
                    <button 
                        disabled= { assignment.buyingPowerUp }
                        className="theia-button powerup-button-turn-in"
                        onClick = { () => { this.turnInCurrentTask(assignment)} } >
                        <i className="fa fa-file-text" aria-hidden="true"></i>
                        &nbsp;Turn current task in
                    </button>
                </div>
            </div>
        }
        else if(assignment.finished) {
            content =
            <div className="assignment-finished">
                <span>You have completed all tasks in this assignment. By using power-up
                'Second Chance' you have another shot at completing one task in this assignment
                which you didn't fully finish. Choose wisely!
                </span>
                <button 
                    disabled = { assignment.buyingPowerUp || !(this.getPowerupAmount('Second Chance') > 0) }
                    className="theia-button af-second-chance-button"
                    onClick = { () => {this.useSecondChancePowerup(assignment)} } >
                    <i className="fa fa-undo" aria-hidden="true"></i>
                    &nbsp;Second Chance
                </button>
            </div>
        }
        return <li
            key = {assignment.id}
            className = "assignment-list-item"
        >
            <div className="theia-header header assignment-header"
                onClick={() => { this.collapseAssignment(assignment.id); }}
            >
                <span className={`theia-ExpansionToggle ${!assignment.collapsed ? ' theia-mod-collapsed' : ''}`}></span>
                <span className="label noselect">{assignment.name}</span>
            </div>
            <div className={`collapse ${assignment.collapsed ? ' in' : ''}`}>
                {content}
            </div>
        </li>
    }

    protected displayMessage(): void {
        this.messageService.info('Congratulations: UupGameView Widget Successfully Created!');
    }

}
  