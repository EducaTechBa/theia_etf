import * as React from 'react';
import { injectable, postConstruct, inject } from 'inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
//import { Assignment, PowerupType, StudentData, GameService, ChallengeConfig, AssignmentDetails, TaskCategory, UsedPowerup, Task} from './uup-game-service';
import { Assignment, PowerupType, StudentData, GameServiceV11, ChallengeConfig, AssignmentDetails, TaskCategory, UsedPowerup, Task } from './uup-game-service-v11';
import { ConfirmDialog, open, OpenerService } from '@theia/core/lib/browser';
import { SelectDialog } from './select-dialogue';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import URI from '@theia/core/lib/common/uri';
// @ts-ignore
import { AutotestService, AutotestEvent } from 'autotest-view/lib/browser/autotest-service';
// import { AutotestViewWidget } from 'autotest-view/lib/browser/autotest-view-widget';
import { GameHelpDialog } from './game-help-dialogue';
import { FileChangeType } from '@theia/filesystem/lib/common/files';
import { MiniBrowserOpenHandler } from '@theia/mini-browser/lib/browser/mini-browser-open-handler';


interface GameInformationState {
    handlers: Record<string, boolean>;
    fileWatchers: Record<string, boolean>;
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

    @inject(GameServiceV11)
    protected readonly gameServiceV11!: GameServiceV11;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(AutotestService)
    protected readonly autotestService: AutotestService;

    // @inject(AutotestViewWidget)
    // protected readonly autotestViewWidget: AutotestViewWidget;

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

    @inject(MiniBrowserOpenHandler)
    protected readonly miniBrowserOpenHandler: MiniBrowserOpenHandler;

    @inject(EditorManager)
    protected readonly editorManager!: EditorManager;

    private state: GameInformationState = {
        handlers: {},
        fileWatchers: {},
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

    private studentCheck = true;
    private gameRunning = true;
    private showRealPoints = false;
    private showTime = false;
    private programDirectoryURI = '';
    private timeSinceLastUpdatedTime = 0;

    @postConstruct()
    protected async init(): Promise < void> {
        this.id = UupGameViewWidget.ID;
        this.title.label = UupGameViewWidget.LABEL;
        this.title.caption = UupGameViewWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-gamepad'; // Gamepad Icon
        
        if (localStorage.getItem('GAME_showRealPoints') === 'true')
            this.showRealPoints = true;
        if (localStorage.getItem('GAME_showTime') === 'true')
            this.showTime = true;

        this.editorManager.onCreated(editorWidget => this.handleEditorSwitch(editorWidget));
        this.editorManager.onCurrentEditorChanged(editorWidget => this.handleEditorSwitch(editorWidget));

        const initialActiveEditor = this.getInitialActiveEditor();
        if (initialActiveEditor) {
            this.handleEditorSwitch(initialActiveEditor)
        }

        const response = await this.gameServiceV11.getGameStatus();
        if (response.success) {
            try {
                this.messageService.info("Started initializing game information state");
                const _initialState = await this.initializeGameInformationState();
                this.setState(state => {
                    state.handlers = _initialState.handlers;
                    state.fileWatchers = _initialState.fileWatchers;
                    state.assignments = _initialState.assignments,
                    state.powerupTypes = _initialState.powerupTypes,
                    state.challengeConfig = _initialState.challengeConfig,
                    state.taskCategories = _initialState.taskCategories,
                    state.studentData =  _initialState.studentData
                });
                setInterval(() => this.tick(), 1000);
            }
            catch(err : any) {
                console.log("ERROR", JSON.stringify(err));
                this.messageService.error("Failed fetching student data. UUP Game extension will not start.");
            }
        }
        else if (response.code == 403) {
            console.log("INFO", response.message);
            this.studentCheck = false;
            this.update()
        }
        else if (response.code == 400) {
            console.log("INFO", response.message);
            this.gameRunning = false;
            this.update()
        }
    }
    
    private async initializeGameInformationState() : Promise<GameInformationState> {
        const _assignments = await this.gameServiceV11.getAssignments();
        const _powerupTypes = await this.gameServiceV11.getPowerupTypes();
        const _challengeConfig = await this.gameServiceV11.getChallengeConfig();
        const _taskCategories = await this.gameServiceV11.getTaskCategories();
        const _studentData = await this.gameServiceV11.getStudentData(_assignments, _powerupTypes, _challengeConfig?.tasksRequired);
        const _handlers = this.generateEmptyHandlers(_assignments);
        const _fileWatchers = this.generateWatchers(_assignments);
        return {
            storeOpen: false,
            buyingPowerup: false,
            handlers: _handlers,
            fileWatchers: _fileWatchers,
            assignments: _assignments,
            powerupTypes: _powerupTypes,
            challengeConfig: _challengeConfig,
            taskCategories: _taskCategories,
            studentData: _studentData
        }
    }

    private getInitialActiveEditor(): EditorWidget | undefined {
        return this.editorManager.currentEditor;
    }

    private async handleEditorSwitch(editorWidget: EditorWidget | undefined) {
        if (!editorWidget) {
            return;
        }

        const uri = editorWidget.getResourceUri()?.toString();
        this.programDirectoryURI = uri ?? '';
    }
    
    private tick() {
        const updateEvery = 60;
        
        const browserFocused = document.hasFocus();
        if (browserFocused) {
            const uri = this.programDirectoryURI;
            if (uri !== undefined && uri.includes("/UUP_GAME/")) {
                this.state.studentData.assignmentsData.forEach( (x: AssignmentDetails) => { 
                    if (uri.includes("/UUP_GAME/" + x.path)) {
                        x.assignmentTime++;
                        x.taskTime++;
                        this.updateAssignmentState(x);
                        this.update();
                        if (this.timeSinceLastUpdatedTime > updateEvery) {
                            this.timeSinceLastUpdatedTime = -1;
                            this.gameServiceV11.updateTaskTime(x);
                        }
                    }
                });
            }
        }
        this.timeSinceLastUpdatedTime++;
    }

    private setState(update: (state: GameInformationState) => void) {
        update(this.state);
        this.update();
    }
    
    private generateWatchers(assignments: Assignment[]) : Record<string, boolean> {
        assignments = assignments.filter( (x) => { return x.active;});
        let fileWatchers : Record<string, boolean> = {};
        assignments.forEach( (x: Assignment) => { 
            fileWatchers[x.name] = true;
            this.createChangeEventListener(x.path);
        });
        return fileWatchers;
    }

    private createChangeEventListener(path : string) {
        let uri = new URI(this.workspaceService.workspace?.resource+`/UUP_GAME/${path}`);
        //let taskSpecificationURI = new URI(this.workspaceService.workspace?.resource+`/UUP_GAME/${assignment.name}/task.html`);
        //let _taskSpecificationURI = new URI(this.workspaceService.workspace?.resource+`/UUP_GAME/${assignment.name}/task.jpg`);
        //let taskSolutionFileURI = new URI(this.workspaceService.workspace?.resource+`/UUP_GAME/${assignment.name}/main.c`);
        this.fileService.onDidFilesChange( async (e) => {

            if(e.contains(uri, FileChangeType.UPDATED)) {
                let resolve = await this.fileService.resolve(uri);
                if(resolve.children?.length) {
                    for(const file of resolve.children) {
                        if(file.isDirectory || file.name[0]==='.')
                            continue;
                        else if(file.name.match(/.+\.c$/))
                            await open(this.openerService, file.resource);
                        else if(file.name.match(/.+\.html$/))
                            await this.miniBrowserOpenHandler.open(file.resource);
                    }
                    // this.autotestViewWidget.refreshWidget(uri.toString());
                    this.autotestService.removeProgram(uri.toString());
                }
            }
        });
    }

    private async closeAllEditorsInFolder(path: string) {
        let uri = new URI(this.workspaceService.workspace?.resource+`/UUP_GAME/${path}`);
        let resolve = await this.fileService.resolve(uri);
        if(resolve.children?.length) {
            for(const file of resolve.children) {
                let fileEditorWidget = await this.editorManager.getByUri(file.resource);
                fileEditorWidget?.close();
            }
        }
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
            this.setState(state => {
                state.buyingPowerup = true;
            });
            const response = await this.gameServiceV11.buyPowerup(powerupType);
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
                this.state.studentData.tokens = response.data.tokens;
            } else {
                this.messageService.error(response.message);
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

        const directoryExists = await this.workspaceService.containsSome([`UUP_GAME/${assignment.path}`]);
        const workspaceURI = this.workspaceService.workspace?.resource || '';
        const assignmentDirectoryURI = `${workspaceURI}/UUP_GAME/${assignment.path}`;
        //Create directory if it does not exist
        if (!directoryExists) {
            await this.fileService.createFolder(new URI(assignmentDirectoryURI));
            if(!this.state.fileWatchers[assignment.name]) {
                this.state.fileWatchers[assignment.name] = true;
                this.createChangeEventListener(assignment.path);
            }
        }  
        //Call service to start asssignment and get a response
        const response = await this.gameServiceV11.startAssignment(assignment);
        if(!response.success) {
            this.messageService.error(response.message);
            this.removeAssignmentFiles(assignment);
        } else {             
            //Update assignment i update state
            assignment.started = true;
            assignment.finished = false;
            assignment.currentTask = {
                name: response.data.task_name,
                taskNumber: response.data.task_number
            }
            this.messageService.info(response.message);
            this.updateAssignmentState(assignment);
            this.openFiles(assignment);
        }        
    }
    
    //Testirati
    private async useHintPowerup(assignment: AssignmentDetails) {
        const dialog = new ConfirmDialog({
            title: "Use power-up confirmation",
            maxWidth: 500,
            msg: `Are you sure you want to use powerup 'Hint' on current task in this assignment? This hint will be permanently visible while you are working on this task, even if you return to it using power-up 'Second Chance'.`,
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
            const response = await this.gameServiceV11.useHint(assignment);
            if(response.success) {
                this.messageService.info(`Hint: ${response.data.hint}`);
                let hint = response.data.hint;
                const index = this.state.studentData?.unusedPowerups.findIndex( (x: any) => { return x.name == 'Hint'; });
                this.state.studentData.unusedPowerups[index].amount -= 1;
                //Update assignmentDetails
                assignment.taskHint = hint;
                assignment.powerupsUsed.push({name: "Hint", taskNumber: assignment.currentTask.taskNumber});
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

    private mapTasksData(data: any) : Task[] {
        let _tasks : Task[] = [];
        for(const x of data) {
            _tasks.push({
                name: x.taskName,
                taskNumber: x.taskNr
            });
        }
        return _tasks;
    }
    //Testirati
    //TODO: 
    // zatvoriti i otvoriti fajlove u editoru.
    private async useSecondChancePowerup(assignment: AssignmentDetails) {
        const scPowerup = this.state.powerupTypes.find( (x: PowerupType) => x.name == 'Second Chance');
        let type_id = -1;
        if(!!scPowerup)
            type_id = scPowerup.id;
        const tasksResponse = await this.gameServiceV11.getSecondChanceAvailableTasks(assignment, type_id);
        if(!tasksResponse.success) {
            this.messageService.error(tasksResponse.message);
            return;
        }
        const tasks = this.mapTasksData(tasksResponse.data);
        if(tasks.length === 0) {
            this.messageService.error(`You do not have any available task to go back to. If you think this is an error, please contact your teacher.`);
            return;
        }
        const result = await new SelectDialog({
            items: tasks,
            label: task => `${task.taskNumber}. ${task.name}`,
            title: 'Use power-up confirmation',
            maxWidth: 500,
            message: `Are you sure you want to use 'Second Chance' power up? You can only return to tasks you haven't fully finished. All progress on current task will be saved. You can only return to specific task once, if you make changes you need to turn it in before using this power-up again, else all progress will be lost. Below is a list of tasks with second chance available, choose wisely!`
        }).open();
        if(!result) 
            return;    
        this.setState(state => {
            let index = state.studentData.assignmentsData.findIndex( x => x.id == assignment.id );
            if(index != -1)
                state.studentData.assignmentsData[index].buyingPowerUp = true;
        });
        let createdFolders = false;
        //If assignment is already finished, we need to regenerate folders for it
        if(assignment.finished) {
            this.messageService.info(`Using 'Second Chance' power-up on finished assignment detected. Regenerating required resources.`);
            await this.generateAssignmentFiles(assignment);
            createdFolders = true;
        }
        const response = await this.gameServiceV11.useSecondChance(assignment, result);
        if(response.success) {
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
            assignment.taskTime = response.data.task_time;
            assignment.powerupsUsed.push({name: "Second Chance", taskNumber: assignment.currentTask.taskNumber});
            const pIndex = assignment.powerupsUsed.findIndex( (x: any) => { return x.name == 'Hint' && x.taskNumber == assignment.currentTask.taskNumber });
            if( pIndex != -1) {
                let usedHintResponse = await this.gameServiceV11.getUsedHint(assignment.id, assignment.currentTask.taskNumber);
                assignment.taskHint = usedHintResponse.data.hint;
            }
            if(assignment.finished) {
                assignment.started = true;
                assignment.finished = false;
            }
            this.updateAssignmentState(assignment);
        } else {
            this.messageService.error(response.message);
            if(createdFolders) {
                this.removeAssignmentFiles(assignment);
                createdFolders = false;
            }
        }
        this.setState(state => {
            let index = state.studentData.assignmentsData.findIndex( x => x.id == assignment.id );
            if(index != -1) {
                state.studentData.assignmentsData[index].buyingPowerUp = false;
            }
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
            msg: `Are you sure you want to use powerup 'Switch Task' on current task in this assignment? This will result in new task being selected from tasks database and assigned to you.`,
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
            const response = await this.gameServiceV11.useSwitchTask(assignment);
            if(response.success) {
                this.messageService.info(`Powerup 'Switch Task' has been used successfully. New task files are now in your workspace. Good luck!`);
                const index = this.state.studentData?.unusedPowerups.findIndex( (x: any) => { return x.name == 'Switch Task'; });
                this.state.studentData.unusedPowerups[index].amount -= 1;
                //Update current assignment
                assignment.powerupsUsed.push({name: "Switch Task", taskNumber: assignment.currentTask.taskNumber}); 
                assignment.currentTask = {
                    name: response.data.task_name,
                    taskNumber: response.data.task_number
                }
                assignment.previousPoints = -1;
                assignment.taskHint = "";
                assignment.taskTime = 0;
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
        const directoryExists = await this.workspaceService.containsSome([`UUP_GAME/${assignment.path}`]);
        const workspaceURI = this.workspaceService.workspace?.resource || '';
        const assignmentDirectoryURI = `${workspaceURI}/UUP_GAME/${assignment.path}`;

        if (!directoryExists) {
            await this.fileService.createFolder(new URI(assignmentDirectoryURI));
            if(!this.state.fileWatchers[assignment.name]) {
                this.state.fileWatchers[assignment.name] = true;
                this.createChangeEventListener(assignment.path);
            } 
        }
    }

    private async removeAssignmentFiles(assignment: AssignmentDetails) {
        const directoryExists = await this.workspaceService.containsSome([`UUP_GAME/${assignment.path}`]);
        const workspaceURI = this.workspaceService.workspace?.resource || '';
        const assignmentDirectoryURI = `${workspaceURI}/UUP_GAME/${assignment.path}`;

        if (directoryExists) {
            await this.fileService.delete(new URI(assignmentDirectoryURI), { recursive:true });
            this.state.fileWatchers[assignment.name] = false;
        }
    }

    private unlockNextAssignment(assignment: AssignmentDetails) {
        let index = this.state.studentData.assignmentsData.findIndex( (x: AssignmentDetails) => x.id == assignment.id);
        if(index == this.state.studentData.assignmentsData.length-1)
            return;
        this.state.studentData.assignmentsData[index+1].unlocked = true;
    }

    private createHtmlNode(type: string, message: string) : HTMLElement {
        const htmlNode = document.createElement(type);
        htmlNode.setAttribute("class", "selectDialogueMessage");
        let messageSpan = document.createElement('span');
        messageSpan.innerHTML = message;
        htmlNode.appendChild(messageSpan);
        return htmlNode;            
    }

    private async openFiles(assignment: AssignmentDetails) {
        if (assignment.finished) return;
        let path = assignment.path;

        const directoryExists = await this.workspaceService.containsSome([`UUP_GAME/${path}`]);
        if (!directoryExists) {
            const dialog = new ConfirmDialog({
                title: 'Files for assignment do not exist',
                maxWidth: 500,
                msg: `Do you want to create default files for this assignment?`,
                ok: "Yes",
                cancel: "No"
            });
            const confirmation = await dialog.open();
            if(confirmation) {
                const response = await this.gameServiceV11.restoreTask(assignment);
                if(response.success) {
                    this.openFiles(assignment);
                } else {
                    this.messageService.error(response.message);
                }
            }
            return;
        }
        
        let uri = new URI(this.workspaceService.workspace?.resource+`/UUP_GAME/${path}`);
        let resolve = await this.fileService.resolve(uri);
        // TODO use assignment files
        if(resolve.children?.length) {
            for(const file of resolve.children) {
                if(file.isDirectory || file.name[0]==='.')
                    continue;
                else if(file.name.match(/.+\.c$/))
                    await open(this.openerService, file.resource);
                else if(file.name.match(/.+\.html$/)) {
                    await this.miniBrowserOpenHandler.open(file.resource, {
                        mode: 'reveal',
                        //widgetOptions: { mode: 'open-to-right' }
                    });
                }
            }
        }

    }

    //TODO:
    // zatvoriti i otvoriti fajlove
    private async turnInCurrentTask(assignment: AssignmentDetails) {
        const workspaceURI = this.workspaceService.workspace?.resource || '';
        const assignmentDirectoryURI = `${workspaceURI}/UUP_GAME/${assignment.path}`;
        //const assignmentDirectoryURI = `${workspaceURI}/UUP_GAME`;

        const dialog = new ConfirmDialog({
            title: "Task turn in confirmation",
            maxWidth: 500,
            msg: `Are you sure you want to turn in current task in this assignment? This action will automatically close tabs related to this task and run tests on current task. Testing can last a while depending on server load. While this action lasts, you can work on another assignment or wait for notification that task has been turned in successfully and work on a new task. Task description will be opened in new tab.`,
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
            try {
                this.messageService.info(`Starting unit testing on task '${assignment.currentTask.name}'.`);
                const testStatus = await this.autotestService.runTests(assignmentDirectoryURI, false);
                if(!testStatus.success) {
                    this.messageService.error("Could not run tests, check if tests are already running and all files are there.");
                    console.log("success " + testStatus.success + " status " + testStatus.status);
                    this.setState(state => {
                        let index = state.studentData.assignmentsData.findIndex( x => x.id == assignment.id );
                        if(index != -1)
                            state.studentData.assignmentsData[index].buyingPowerUp = false;
                    });
                }
            } catch(err) {
                console.log(`This occurred when running autotest from UUPGameViewWidget: ${err}`);
                this.messageService.error("An error occured when attempting to run tests!");
                this.setState(state => {
                    let index = state.studentData.assignmentsData.findIndex( x => x.id == assignment.id );
                    if(index != -1)
                        state.studentData.assignmentsData[index].buyingPowerUp = false;
                });
                return;
            }
            let check = this.state.handlers[assignment.name];
            if(!check) {
                this.state.handlers[assignment.name] = true;
                
                this.autotestService.onTestsFinished( async (e: AutotestEvent) => {
                    console.log("OnTestsFinished fired check:", e.program.isUserInvoked, e.program.uri);
                    console.log("EVENT:", e);
                    if(e.program.isUserInvoked || e.program.uri !== assignmentDirectoryURI)
                        return;
                    //console.log("OnTestsFinished fired: ", assignmentDirectoryURI);
                    let tpResults = await this.autotestService.getTestPassResults(assignmentDirectoryURI);
                    let results = {
                        "passed_tests": tpResults.passed,
                        "total_tests": tpResults.total
                    }
                    //Testing purposes
                    /*
                    results = {
                        "passed_tests": 9,
                        "total_tests": 10
                    }
                    */
                    let msg = `Testing task '${assignment.currentTask.name}' has been completed.\n\n${results.passed_tests} out of ${results.total_tests} tests passed.\n\nAre you sure you want to turn in this task?`;
                    let htmlMessageNode = this.createHtmlNode('div', msg);
                    const _dialog = new ConfirmDialog({
                        title: "Task turn in confirmation",
                        maxWidth: 500,
                        msg: htmlMessageNode,
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
                    await this.closeAllEditorsInFolder(assignment.path);
                    const response = await this.gameServiceV11.turnInTask(assignment);
                    if(response.success) {
                        this.messageService.info(response.message);
                        if (response.data.taskData.reason.length > 0)
                            this.messageService.info("You are back on task " + response.data.taskData.task_name + " because: " + response.data.taskData.reason);
                        if(assignment.previousPoints == -1)
                            assignment.tasksTurnedIn += 1;
                        //Update assignment and set state
                        assignment.currentTask = {
                            name: response.data.taskData.task_name,
                            taskNumber: response.data.taskData.task_number
                        };
                        if(results.passed_tests === results.total_tests) {
                            assignment.tasksFullyFinished += 1;
                        }
                        if(this.state.challengeConfig.tasksRequired-assignment.tasksFullyFinished > 0) 
                            this.messageService.warn(`You need to complete ${this.state.challengeConfig.tasksRequired-assignment.tasksFullyFinished}
                                more task${this.state.challengeConfig.tasksRequired-assignment.tasksFullyFinished==1?'':'s'}
                                with all tests succeeded to unlock next assignment. Do not get locked out!`);
                        else this.unlockNextAssignment(assignment);
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
                        this.messageService.info(`You earned ${Math.floor(response.data.points*1000)} XP and ${response.data.tokens} tokens.`);
                        if(Object.keys(_additionalTokens).length !== 0 && _additionalTokens.constructor === Object) {
                            if(!!_additionalTokens.amount && _additionalTokens.amount != 0) 
                                this.messageService.info(`Congratulations! You earned additional ${_additionalTokens.amount} tokens.
                                Reason: ${_additionalTokens.reason}`)
                            this.state.studentData.tokens += _additionalTokens.amount;
                        }
                        if(response.data.assignmentDone) {
                            assignment.finished = true;
                            assignment.tasksTurnedIn = this.getTotalTasks();
                            this.messageService.info(`Congratulations! You have completed all tasks in assignment '${assignment.name}.'`);
                            this.removeAssignmentFiles(assignment);
                        }
                        assignment.taskHint = "";
                        assignment.taskTime = 0;
                        this.updateAssignmentState(assignment);
                        if (!assignment.finished)
                            this.openFiles(assignment);
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

    private openGameHelpDialog() {
        let helpDialog = new GameHelpDialog({title:"UUP GAME INFORMATION & HELP"});
        helpDialog.setGameViewWidget(this);
        helpDialog.open();
    }
    protected render(): React.ReactNode {  
        let content;
        if(!this.gameRunning) {
            content = <div id='uup-game-container'>
                        <div style={{margin: "10px 10px 10px 10px !important"}}>{this.renderAlertBox('error', 'fa fa-times-circle', 'Game not running',
                                `UUP Game is currently down for maintenance.`)}
                        </div>
                      </div>
        }
        else if(!this.studentCheck) {
            content = <div id='uup-game-container'>
                        <div style={{margin: "10px 10px 10px 10px !important"}}>{this.renderAlertBox('error', 'fa fa-times-circle', 'Access denied',
                                `You are not enrolled into a course that supports UUP Game in current academic year.
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
        if(points >= 40 ) {
            level = 40;
            progress = 100;
            xp = 1000;
        }
        /*   <span className="game-rules"><a href="#" onClick= { (e) => {e.preventDefault(); this.openGameRules()} }>GAME RULES</a></span> */
        
        let pointsDisplay: React.ReactNode;
        if (this.showRealPoints)
            pointsDisplay = "Points: " + points;
        else
            pointsDisplay = "XP: " + xp + "/1000";
        
        return <div className='student-info'>
            <div className="student-header">
                <span>{header}</span>
                <button
                    className="theia-button helpDialogButton"
                    onClick = { () => {this.openGameHelpDialog()} } >
                    <i className="fa fa-info-circle" aria-hidden="true"></i>
                </button>
            </div>
          
            <span className="student-level">Level: {level}</span>
            <div className="progress-bar">
                    <span className="progress-bar-span">{progress.toFixed(2)}%</span>
                    <div className="progress-bar-xp" style={{width: `${progress.toFixed(2)}%`}}></div>
            </div>
            <span className="student-xp">{pointsDisplay}</span>
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

        return <div className='theia-alert-message-container' >
            <div className={`theia-${type.toLowerCase()}-alert`}>
                <div className='theia-message-header'>
                    <i className={`${icon}`}></i>&nbsp;
                    {header}
                </div>
                <div className='theia-message-content' >{message}</div>
            </div>
        </div>;
    
    }
    
    private timeToHMS(time: number) : string {
        let result = '';
        let hours = Math.floor(time / 3600);
        if (hours > 0) {
            if (hours < 10) result += '0';
            result += hours + ':';
            time = time - hours * 3600;
        }
        let minutes = Math.floor(time / 60);
        if (minutes < 10) result += '0';
        result += minutes + ':';
        time = time - minutes * 60;
        if (time < 10) result += '0';
        result += time;
        return result;
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
            let taskTimeContent: React.ReactNode;
            let assignmentTimeContent: React.ReactNode;
            if (this.showTime) {
                let taskTime = 0;
                let assignmentTime = 0
                const index = this.state.studentData.assignmentsData.findIndex( x => x.id == assignment.id);
                if (index >= 0) {
                     taskTime = this.state.studentData.assignmentsData[index].taskTime;
                     assignmentTime = this.state.studentData.assignmentsData[index].assignmentTime;
                }
                taskTimeContent =
                    <span className="span">Time spent on task: {this.timeToHMS(taskTime)}</span>
                assignmentTimeContent =
                    <span className="span">Time spent on assignment: {this.timeToHMS(assignmentTime)}</span> 
            }
            
            content = 
            <div>
                <span className="open-files"><button onClick={ () => {this.openFiles(assignment)} }><i className="fa fa-search" aria-hidden="true"></i> Open</button></span>
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
                    {taskTimeContent}
                    {assignmentTimeContent}
                    
                    <div className={`collapse ${ assignment.tasksFullyFinished<this.state.challengeConfig.tasksRequired ? ' in' : ''}`}>
                        {this.renderAlertBox('warning', 'fa fa-exclamation-circle', 'Warning',
                        `You need to complete ${this.state.challengeConfig.tasksRequired-assignment.tasksFullyFinished}
                        more task${this.state.challengeConfig.tasksRequired-assignment.tasksFullyFinished==1?'':'s'}
                        with all tests succeeded to unlock next assignment. Do not get locked out!`)}
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
    
    public getShowRealPoints(): boolean {
        return this.showRealPoints;
    }
    
    public setShowRealPoints(value : boolean): void {
        this.showRealPoints = value;
        this.update();
        localStorage.setItem('GAME_showRealPoints', JSON.stringify(value));
    }
    
    public getShowTime(): boolean {
        return this.showTime;
    }
    
    public setShowTime(value : boolean): void {
        this.showTime = value;
        this.update();
        localStorage.setItem('GAME_showTime', JSON.stringify(value));
    }

}
  
