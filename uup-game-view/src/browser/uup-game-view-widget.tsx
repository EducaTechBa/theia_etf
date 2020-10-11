import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { Assignment, PowerupType, StudentData, GameService, ChallengeConfig, AssignmentDetails} from './uup-game-service';
import { ConfirmDialog } from '@theia/core/lib/browser';
import { SelectDialog } from './select-dialogue';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { AutotestService, AutotestEvent } from 'autotest-view/lib/browser/autotest-service';


interface GameInformationState {
    storeOpen: boolean;
    buyingPowerup: boolean;
    assignments: Assignment[];
    powerupTypes: PowerupType[];
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
        storeOpen: false,
        buyingPowerup: false,
        assignments: [],
        powerupTypes: [],
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

    @postConstruct()
    protected async init(): Promise < void> {
        this.id = UupGameViewWidget.ID;
        this.title.label = UupGameViewWidget.LABEL;
        this.title.caption = UupGameViewWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-gamepad'; // Gamepad Icon

        const _assignments = await this.gameService.getAssignments();
        const _powerupTypes = await this.gameService.getPowerupTypes();
        const _challengeConfig = await this.gameService.getChallengeConfig();
        //const _taskCategories = await this.gameService.getTaskCategories();
        const _studentData = await this.gameService.getStudentData(_assignments, _powerupTypes, _challengeConfig.tasksRequired);
        this.setState(state => {
            state.assignments = _assignments;
            state.powerupTypes = _powerupTypes;
            state.challengeConfig = _challengeConfig;
            state.studentData = _studentData;
        });

        this.update();
    }

    private setState(update: (state: GameInformationState) => void) {
        update(this.state);
        this.update();
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
                this.messageService.info('Powerup bla bla bla has been basljdaldja');
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
    private async startAssignment(assignment: AssignmentDetails) {
        //Call service to start asssignment and get a response
        const response = await this.gameService.startAssignment(assignment);
        //U zavisnosti od responsea izbacit message
        if(!response.success) {
            console.log(JSON.stringify(response));
            debugger;
            this.messageService.error(response.message);
        } else {
            const directoryExists = await this.workspaceService.containsSome([assignment.name]);
            const workspaceURI = this.workspaceService.workspace?.resource || '';
            const assignmentDirectoryURI = `${workspaceURI}/${assignment.name}`;
            //Create directory if it does not exist
            if (!directoryExists) {
                this.messageService.info(`Generating sources for '${assignment.name}'...`);
                await this.fileService.createFolder(new URI(assignmentDirectoryURI));
                this.messageService.info(`Sources for '${assignment.name}' generated successfully!`);
            } else {
                this.messageService.error(`Resources for '${assignment.name}' already exist.`);
            }   
            //Update assignment i update state
            assignment.started = true;
            assignment.finished = false;
            assignment.currentTask = response.data.taskData;
            this.updateAssignmentState(assignment);
            //Otvoriti nove fajlove
        }        
    }
    
    //Testirati
    private async useHintPowerup(assignment: AssignmentDetails) {
        const dialog = new ConfirmDialog({
            title: "Use power-up confirmation",
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
    //TODO: rijesiti problem sa poenima prilikom vracanja nazad.
    // zatvoriti i otvoriti fajlove u editoru.
    private async useSecondChancePowerup(assignment: AssignmentDetails) {

        const tasks = await this.gameService.getSecondChanceAvailableTasks(assignment);
        const result = await new SelectDialog({
            items: tasks,
            label: task => `${task.taskNumber}. ${task.name}`,
            title: 'Second Chance',
            message: `Are you sure you want to use 'Second Chance' power up?
You can only return to tasks you haven't fully finished. All 
progress on current task will be saved. You can only return to 
specific task once, if you make changes you need to turn it in
before using this power-up again, else all progress will be lost. Below is a list of tasks with
second chance available, choose wisely!`,
            style: {
            }
        }).open();
        if(!result) 
            return;    
        this.messageService.info(`Using power-up second chance. Returning to task ${result.name}.`);
        this.setState(state => {
            let index = state.studentData.assignmentsData.findIndex( x => x.id == assignment.id );
            if(index != -1)
                state.studentData.assignmentsData[index].buyingPowerUp = true;
                assignment.buyingPowerUp = true;
        });
        //If assignment is already finished, we need to regenerate folders for it
        if(assignment.finished) {
            this.messageService.info(`Using 'Second Chance' power-up on finished assignment detected. Regenerating required resources.`);
            this.generateAssignmentFiles(assignment);
            assignment.started = true;
            assignment.finished = false;
        }
        const response = await this.gameService.useSecondChance(assignment);
        if(response.success) {
            this.messageService.info(`Power-up 'Second Chance' has been used sucessfully.`);
            this.messageService.info(`You are now back to task ${response.taskData.name} [Task ${response.taskData.taskNumber}].`);
            const index = this.state.studentData?.unusedPowerups.findIndex( (x: any) => { return x.name == 'Second Chance'; });
            this.state.studentData.unusedPowerups[index].amount -= 1;
            //Update current task
            assignment.currentTask = response.taskData;
            //Update hint if existing
            assignment.taskHint = "";
            const pIndex = assignment.powerupsUsed.findIndex( (x: any) => { return x.name == 'Hint' && x.taskNumber == assignment.currentTask.taskNumber });
            if( pIndex != -1) {
                assignment.taskHint = await this.gameService.getUsedHint(assignment.id, assignment.currentTask.taskNumber);
            }

        } else {
            this.messageService.error(response.message);
        }
        this.setState(state => {
            let index = state.studentData.assignmentsData.findIndex( x => x.id == assignment.id );
            if(index != -1) {
                state.studentData.assignmentsData[index].buyingPowerUp = false;
            }
            assignment.buyingPowerUp = false;
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
                this.state.studentData.tokens = response.data?.tokens;
                //Update current assignment
                assignment.powerupsUsed.push({name: "Switch Task", taskNumber: assignment.currentTask.taskNumber}); 
                assignment.currentTask = {
                    name: response.data.taskData.task_name,
                    taskNumber: response.data.taskData.task_number
                }
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
        const directoryExists = await this.workspaceService.containsSome([assignment.name]);
        const workspaceURI = this.workspaceService.workspace?.resource || '';
        const assignmentDirectoryURI = `${workspaceURI}/${assignment.name}`;

        if (!directoryExists) {
            this.messageService.info(`Generating sources for '${assignment.name}'...`);
            await this.fileService.createFolder(new URI(assignmentDirectoryURI));
            this.messageService.info(`Sources for ${assignment.name} generated successfully!`);
        }

    }    
    //TODO:
    // zatvoriti i otvoriti fajlove
    private async turnInCurrentTask(assignment: AssignmentDetails) {
        const workspaceURI = this.workspaceService.workspace?.resource || '';
        //const assignmentDirectoryURI = `${workspaceURI}/${assignment.name}`;
        const assignmentDirectoryURI = `${workspaceURI}/UUP/T2/Z2`;
        console.log("Checkpoint 1:", assignmentDirectoryURI);

        //dijalozi i sranja
        const dialog = new ConfirmDialog({
            title: "Task turn in confirmation",
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
            // pokrenuti i sacekati testiranje
            this.messageService.info(`Starting unit testing on task ${assignment.currentTask.name}.`);
            this.autotestService.runTests(assignmentDirectoryURI);
            console.log("Checkpoint 2: Started runTests method");
            //Hoce li praviti problem kad se second chance vrati 
            
            this.autotestService.onTestsFinished( async (e: AutotestEvent) => {
                console.log("OnTestsFinished fired");
                if(e.program.uri !== assignmentDirectoryURI)
                    return;
                //Ako jeste nastavi
                let results = await this.autotestService.getTestPassResults(assignmentDirectoryURI);
                console.log(JSON.stringify(results));
            })
        }
       
        // pozvati servis
        //const response = await this.gameService.turnInTask(assignment);
        // upisati odgovarjuce podatke i setState pozvati
        // otvoriti novi task
    }
    
    
    protected render(): React.ReactNode {  
        return <div id='uup-game-container'>
            {this.renderGeneralStudentInfo(this.state.studentData)}
            <ul className="assignments-list">
                <li>{this.renderPowerupStoreInfo()}</li>
                {this.state.studentData?.assignmentsData.map(assignmentDetails => this.renderAssignmentDetails(assignmentDetails))}
            </ul>
        </div>
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
                        disabled= { this.state.buyingPowerup && this.state.studentData.tokens >= powerupType.price }
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
        return <div className='student-info'>
            <span className="student-header">{header}</span>
            <span className="student-level">Level: {level}</span>
            <div className="progress-bar">
                    <span className="progress-bar-span">{progress}</span>
                    <div className="progress-bar-xp" style={{width: `${progress}%`}}></div>
            </div>
            <span className="student-xp">XP: {xp}/1000</span>
            {this.renderPowerupStatus()}
        </div>
    }

    private renderPowerupStatus() : React.ReactNode {
        return <table className="powerups-table">
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
        </table>
    }  

    private renderHint(hint: string) : React.ReactNode {

        return <div className='theia-alert-message-container'>
            <div className={`theia-info-alert`}>
                <div className='theia-message-header'>
                    <i className='INFO'></i>&nbsp;
                    Hint for current task
                </div>
                <div className='theia-message-content'>{hint}</div>
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
            let percent = ((assignment.tasksTurnedIn/15)*100).toFixed(2);
            //(Math.round(maxPointsPct * assignmentMaxPoints*100)/100).toFixed(2);           
            content = 
            <div>
                <span className="assignment-progress">Assignment Progress</span>
                <div className="progress-bar">
                    <span className="progress-bar-span">{percent}%</span>
                    <div className="progress-bar-green" style={{width: `${percent}%`}}></div>
                </div>
                <div className="assignment-content">
                    <span className="span">Total tasks: 15</span>
                    <span className="span">Tasks turned in: {assignment.tasksTurnedIn}</span>
                    <span className="span">Tasks fully finished: {assignment.tasksFullyFinished}</span>
                    <span className="span">Current task: {assignment.currentTask.taskNumber}</span>
                    <span className="span">Task name: {assignment.currentTask.name}</span> 
                    <div className={`collapse ${ assignment.taskHint != "" ? ' in' : ''}`}>
                        {this.renderHint(assignment.taskHint)}
                    </div>
                </div>
                <div className="powerups-buttons">
                    <button 
                        disabled= { assignment.buyingPowerUp }
                        className="theia-button powerup-button"
                         onClick={ () => {this.useHintPowerup(assignment)} }>
                        <i className="fa fa-lightbulb-o" aria-hidden="true"></i>
                    </button>
                    <button 
                        disabled= { assignment.buyingPowerUp }
                        className="theia-button powerup-button"
                        onClick = { () => {this.useSecondChancePowerup(assignment)} } >
                        <i className="fa fa-undo" aria-hidden="true"></i>
                    </button>
                    <button 
                        disabled= { assignment.buyingPowerUp }
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
                <button className="theia-button af-second-chance-button"><i className="fa fa-undo" aria-hidden="true"></i>&nbsp;Second Chance</button>
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

    /*
    Implementirati: 
    Upozorenje o otkljucavanju iduceg assignment-a

    Popraviti level/progress
    */
}
  