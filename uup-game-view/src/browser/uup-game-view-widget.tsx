import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
//import { AlertMessage } from '@theia/core/lib/browser/widgets/alert-message';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { FileSystem } from '@theia/filesystem/lib/common';
import { Assignment, PowerupType, StudentData, GameService, ChallengeConfig, AssignmentDetails} from './uup-game-service';


interface GameInformationState {
    storeOpen: boolean;
    assignments: Assignment[];
    powerupTypes: PowerupType[];
    challengeConfig?: ChallengeConfig;
    studentData?: StudentData;
}



@injectable()
export class UupGameViewWidget extends ReactWidget {

    static readonly ID = 'uup-game-view:widget';
    static readonly LABEL = 'UUP Game';

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @inject(FileSystem)
    protected readonly fileSystem!: FileSystem;

    @inject(GameService)
    protected readonly gameService!: GameService;

    private state: GameInformationState = {
        storeOpen: false,
        assignments: [],
        powerupTypes: [],
        challengeConfig: undefined,
        studentData: undefined
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

    private buyPowerup(powerupType: PowerupType) {
        //Confirmation window
        //Block while buying
        //Send request
    }

    protected render(): React.ReactNode {
        /*
        const header = `This is a sample widget which simply calls the messageService
        in order to display an info message to end users.`;
        return <div id='widget-container'>
            <AlertMessage type='INFO' header={header} />
            <button className='theia-button secondary' title='Display Message' onClick={_a => this.displayMessage()}>Display Message</button>
        </div>
        */        
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
                    <button className="theia-button"
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
                <button className="theia-button start-assignment-button">Start Assignment</button>
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
                </div>
                <div className="powerups-buttons">
                    <button className="theia-button powerup-button">
                        <i className="fa fa-lightbulb-o" aria-hidden="true"></i>
                    </button>
                    <button className="theia-button powerup-button">
                        <i className="fa fa-undo" aria-hidden="true"></i>
                    </button>
                    <button className="theia-button powerup-button">
                        <i className="fa fa-exchange" aria-hidden="true"></i>
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
    -Buy / Turn-in / Powerup-e
    -Start assignment / second chance na zatvoren assignment.
    Upozorenje o otkljucavanju iduceg assignment-a
    Prikaz hinta na zadatku gdje je vec bio
    Popraviti level/progress
    */
}
