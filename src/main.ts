/*
 * Created with @iobroker/create-adapter v1.32.0
 */
import * as utils from '@iobroker/adapter-core';
import axios from 'axios';

interface AlertItem {
	alm_sn: string,
	alert_id: string,
	error_code: string,
	headline: string,
	date: string,
	message: string,
	read_status: string,
	flag: string,
	push: string
}

const URL = 'https://api.indego.iot.bosch-si.com/api/v1/';

let contextId: string;
// let userId: string;
let alm_sn: string;
let currentStateCode = 0;
let refreshMode = 1;
let automaticStateRefresh = true;
let botIsMoving = true;

let connected = false;
let requestRunning = false;
let requestGetOperationData = false;
let requestGetMachineData = false;
let requestGetAlerts = false;
let requestGetMap = false;
let requestConnect  = false;

let firstRun = true;
let notMovingCount = 0;
let interval1: ReturnType<typeof setInterval>;
let interval2: ReturnType<typeof setInterval>;
let interval3: ReturnType<typeof setInterval>;

const stateCodes = [
	[0, 'Reading status',0],
	[257, 'Charging',0],
	[258, 'Docked',0],
	[259, 'Docked - Software update',0],
	[260, 'Docked - Charging',0],
	[261, 'Docked',0],
	[262, 'Docked - Loading map',0],
	[263, 'Docked - Saving map',0],
	[266, 'Docked',0],
	[512, 'Leaving dock',1],
	[513, 'Mowing',1],
	[514, 'Relocalising',1],
	[515, 'Loading map',1],
	[516, 'Learning lawn',1],
	[517, 'Paused',0],
	[518, 'Border cut',1],
	[519, 'Idle in lawn',0],
	[520, 'Learning lawn',1],
	[768, 'Returning to Dock',1],
	[769, 'Returning to Dock',1],
	[770, 'Returning to Dock',1],
	[771, 'Returning to Dock - Battery low',1],
	[772, 'Returning to dock - Calendar timeslot ended',1],
	[773, 'Returning to dock - Battery temp range',1],
	[774, 'Returning to dock',1],
	[775, 'Returning to dock - Lawn complete',1],
	[776, 'Returning to dock - Relocalising',1],
	[1025, 'Diagnostic mode',0],
	[1026, 'EOL Mode',0],
	[1281, 'Software update',0],
	[1537, 'Low power mode',0],
	[64513, 'Docked - Waking up',0] //Angehalten???
]

class Boschindego extends utils.Adapter {

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'boschindego',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	private async onReady(): Promise<void> {
		// Initialize your adapter here
		const refreshConfig = await this.getStateAsync('config.automatic_state_refresh');
		automaticStateRefresh = refreshConfig ? !!refreshConfig.val : automaticStateRefresh;

		if (this.config.username && this.config.password) {
			this.connect(this.config.username, this.config.password, true);
		} else {
			this.setForeignState('system.adapter.' + this.namespace + '.alive', false);
			this.log.error('Please provide your credentials');
		}

		await this.setObjectNotExistsAsync('state.state', {
			type: 'state',
			common: {
				name: 'state',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('state.stateText', {
			type: 'state',
			common: {
				name: 'stateText',
				type: 'string',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('state.mowmode', {
			type: 'state',
			common: {
				name: 'mowmode',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('state.xPos', {
			type: 'state',
			common: {
				name: 'xPos',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('state.yPos', {
			type: 'state',
			common: {
				name: 'yPos',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('state.runtime.total.operate', {
			type: 'state',
			common: {
				name: 'operate',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('state.runtime.total.charge', {
			type: 'state',
			common: {
				name: 'charge',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('state.runtime.session.operate', {
			type: 'state',
			common: {
				name: 'operate',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('state.runtime.session.charge', {
			type: 'state',
			common: {
				name: 'charge',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('state.xPos', {
			type: 'state',
			common: {
				name: 'xPos',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('state.map_update_available', {
			type: 'state',
			common: {
				name: 'map_update_available',
				type: 'boolean',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('state.mapsvgcache_ts', {
			type: 'state',
			common: {
				name: 'mapsvgcache_ts',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('state.svg_xPos', {
			type: 'state',
			common: {
				name: 'svg_xPos',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('state.svg_yPos', {
			type: 'state',
			common: {
				name: 'svg_yPos',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('state.config_change', {
			type: 'state',
			common: {
				name: 'config_change',
				type: 'boolean',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('state.mow_trig', {
			type: 'state',
			common: {
				name: 'mow_trig',
				type: 'boolean',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('state.mowed', {
			type: 'state',
			common: {
				name: 'mowed',
				type: 'number',
				min: 0,
				max: 100,
				unit: '%',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync('map.mapSVG', {
			type: 'state',
			common: {
				name: 'mapSVG',
				type: 'string',
				min: 0,
				max: 100,
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('map.mapSVGwithIndego', {
			type: 'state',
			common: {
				name: 'mapSVGwithIndego',
				type: 'string',
				min: 0,
				max: 100,
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync('alerts.list', {
			type: 'state',
			common: {
				name: 'list',
				type: 'string',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('alerts.count', {
			type: 'state',
			common: {
				name: 'count',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('alerts.error', {
			type: 'state',
			common: {
				name: 'error',
				type: 'boolean',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('alerts.last.error_code', {
			type: 'state',
			common: {
				name: 'error_code',
				type: 'string',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('alerts.last.headline', {
			type: 'state',
			common: {
				name: 'headline',
				type: 'string',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('alerts.last.date', {
			type: 'state',
			common: {
				name: 'date',
				type: 'string',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('alerts.last.message', {
			type: 'state',
			common: {
				name: 'message',
				type: 'string',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('alerts.last.flag', {
			type: 'state',
			common: {
				name: 'flag',
				type: 'string',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync('machine.alm_sn', {
			type: 'state',
			common: {
				name: 'alm_sn',
				type: 'string',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('machine.service_counter', {
			type: 'state',
			common: {
				name: 'service_counter',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('machine.needs_service', {
			type: 'state',
			common: {
				name: 'needs_service',
				type: 'boolean',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('machine.alm_mode', {
			type: 'state',
			common: {
				name: 'alm_mode',
				type: 'string',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('machine.bare_tool_number', {
			type: 'state',
			common: {
				name: 'bareToolnumber',
				type: 'string',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('machine.alm_firmware_version', {
			type: 'state',
			common: {
				name: 'alm_firmware_version',
				type: 'string',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync('operationData.battery.voltage', {
			type: 'state',
			common: {
				name: 'voltage',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('operationData.battery.cycles', {
			type: 'state',
			common: {
				name: 'cycles',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('operationData.battery.discharge', {
			type: 'state',
			common: {
				name: 'discharge',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('operationData.battery.ambient_temp', {
			type: 'state',
			common: {
				name: 'ambient_temp',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('operationData.battery.battery_temp', {
			type: 'state',
			common: {
				name: 'battery_temp',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('operationData.battery.percent', {
			type: 'state',
			common: {
				name: 'percent',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync('operationData.garden.signal_id', {
			type: 'state',
			common: {
				name: 'signal_id',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('operationData.garden.size', {
			type: 'state',
			common: {
				name: 'size',
				type: 'number',
				role: 'value',
				unit: 'm³',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('operationData.garden.inner_bounds', {
			type: 'state',
			common: {
				name: 'inner_bounds',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('operationData.garden.cuts', {
			type: 'state',
			common: {
				name: 'cuts',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('operationData.garden.runtime', {
			type: 'state',
			common: {
				name: 'runtime',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('operationData.garden.charge', {
			type: 'state',
			common: {
				name: 'charge',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('operationData.garden.bumps', {
			type: 'state',
			common: {
				name: 'bumps',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('operationData.garden.stops', {
			type: 'state',
			common: {
				name: 'stops',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('operationData.garden.last_mow', {
			type: 'state',
			common: {
				name: 'last_mow',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('operationData.garden.map_cell_size', {
			type: 'state',
			common: {
				name: 'map_cell_size',
				type: 'number',
				role: 'value',
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync('config.automatic_state_refresh', {
			type: 'state',
			common: {
				name: 'Automatic state refresh',
				desc: 'If true, state is refreshed regularly',
				type: 'boolean',
				role: 'switch',
				read: true,
				write: true,
				def: true
			},
			native: {},
		});

		await this.setObjectNotExistsAsync('commands.mow', {
			type: 'state',
			common: {
				name: 'Mow',
				desc: 'Start mowing',
				type: 'boolean',
				role: 'button',
				read: false,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('commands.go_home', {
			type: 'state',
			common: {
				name: 'Go home',
				desc: 'Return to docking station',
				type: 'boolean',
				role: 'button',
				read: false,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('commands.pause', {
			type: 'state',
			common: {
				name: 'Pause',
				desc: 'Pause mowing',
				type: 'boolean',
				role: 'button',
				read: false,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('commands.refresh_state', {
			type: 'state',
			common: {
				name: 'Refresh state',
				desc: 'Refresh state',
				type: 'boolean',
				role: 'button',
				read: false,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('commands.clear_alerts', {
			type: 'state',
			common: {
				name: 'Clear alerts',
				desc: 'Clear alerts',
				type: 'boolean',
				role: 'button',
				read: false,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('info.connection', {
			type: 'state',
			'common': {
				'role': 'indicator.connected',
				'name': 'Communication with service working',
				'type': 'boolean',
				'read': true,
				'write': false,
				'def': false
			},
			native: {},
		});

		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		this.subscribeStates('commands.mow');
		this.subscribeStates('commands.pause');
		this.subscribeStates('commands.go_home');
		this.subscribeStates('commands.refresh_state');
		this.subscribeStates('commands.clear_alerts');
		this.subscribeStates('config.automatic_state_refresh');


		interval1 = setInterval(()=> {
			if (refreshMode == 1 && automaticStateRefresh) {
				this.connect(this.config.username, this.config.password, false);
				// this.checkAuth(this.config.username, this.config.password);
				this.refreshState(false);
			}
			if (botIsMoving == false) {
				refreshMode = 2;
				const d = new Date();
				const n = d.getHours();
				if (n >= 22 || n < 7) {
					if(refreshMode != 3){
						// this.log.info('Switch to refresh mode 3');
					}
					refreshMode = 3;
				} else {
					if(refreshMode != 2){
						// this.log.info('Switch to refresh mode 2');
					}
					refreshMode = 2;
				}
			} else {
				if(refreshMode != 1){
					// this.log.info('Switch to refresh mode 1');
				}
				refreshMode = 1;
			}
		}
		,20000)

		interval2 = setInterval(()=> {
			if (refreshMode == 2 && automaticStateRefresh) {
				this.connect(this.config.username, this.config.password, false);
				this.refreshState(false);
			}
		}
		,60000)

		interval3 = setInterval(()=> {
			if (refreshMode == 3 && this.config.deepSleepAtNight == false && automaticStateRefresh) {
				this.connect(this.config.username, this.config.password, false);
				this.refreshState(false);
			}
		}
		,1800000)
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 */
	private onUnload(callback: () => void): void {
		try {
			clearInterval(interval1);
			clearInterval(interval2);
			clearInterval(interval3);
			callback();
		} catch (e) {
			callback();
		}
	}

	private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

			if (id.indexOf('mow') >= 0) {
				this.mow();
			}
			if (id.indexOf('pause') >= 0) {
				this.pause();
			}
			if (id.indexOf('go_home') >= 0) {
				this.goHome();
			}
			if (id.indexOf('refresh_state') >= 0) {
				this.refreshState(true);
			}
			if (id.indexOf('clear_alerts') >= 0) {
				this.clearAlerts();
			}

			if (id.indexOf('automatic_state_refresh') >= 0) {
				automaticStateRefresh = !!state.val;
				if(automaticStateRefresh){
					refreshMode = 1;
				}
			}
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	private connect(username: string,password: string, force: boolean): void {
		if (requestConnect === false) {
			if (connected == false || force == true) {
				this.log.info('connect');
				const buff = Buffer.from(username + ':' + password, 'utf-8');
				const base64 = buff.toString('base64');
				requestConnect = true;
				axios({
					method: 'POST',
					url: `${URL}authenticate`,
					headers: {
						'Authorization': `Basic ${base64}`,
						'Content-Type': 'application/json'
					},
					data: {device:'', os_type:'Android', os_version:'4.0', dvc_manuf:'unknown', dvc_type:'unknown'}
				}).then(res => {
					requestConnect = false;
					this.log.info('connect ok');
					this.log.debug('connect data: ' + res.data);

					contextId = res.data.contextId;
					// userId = res.data.userId;
					alm_sn = res.data.alm_sn;
					connected = true;
					this.setStateAsync('info.connection', true, true);
					this.setForeignState('system.adapter.' + this.namespace + '.alive', true);
					this.refreshState(false);
				}).catch(err => {
					requestConnect = false;
					// this.log.error(JSON.stringify(err));
					this.log.debug('connection error: ' + err);
					this.log.error('connection error - credentials wrong or no network?');
					connected = false;
					this.setStateAsync('info.connection', false, true);
					// this.setForeignState('system.adapter.' + this.namespace + '.alive', false);
					// this.terminate('Connection error. Credentials wrong?',0);
				});
			}
		}
	}

	private checkAuth(username: string,password: string): void {
		const buff = Buffer.from(username + ':' + password, 'utf-8');
		const base64 = buff.toString('base64');
		axios({
			method: 'GET',
			url: `${URL}authenticate/check`,
			headers: {
				'Authorization': `Basic ${base64}`,
				'x-im-context-id': `${contextId}`
			}
		}).then(async res => {
			this.log.debug('checkAuth: ' + res);
		}).catch(err => {
			this.log.error('error in check auth request: ' + err);
		});
	}

	private mow(): void{
		this.log.info('mow command sent')
		axios({
			method: 'PUT',
			url: `${URL}alms/${alm_sn}/state`,
			headers: {
				'x-im-context-id': `${contextId}`
			},
			data: { state: 'mow' }
		}).then(res => {
			this.log.debug('mow res: ' + res.data);
		}).catch(err => {
			this.log.error('error in mow request: ' + err);
		});
		this.clearAlerts();
		this.refreshState(false);
	}

	private goHome(): void{
		this.log.info('return to dock command sent')
		axios({
			method: 'PUT',
			url: `${URL}alms/${alm_sn}/state`,
			headers: {
				'x-im-context-id': `${contextId}`
			},
			data: { state: 'returnToDock' }
		}).then(res => {
			this.log.debug('returnToDock res: ' + res.data);
		}).catch(err => {
			this.log.error('error in returnToDock request: ' + err);
		});
		this.clearAlerts();
		this.refreshState(false);
	}

	private pause(): void{
		this.log.info('pause command sent')
		axios({
			method: 'PUT',
			url: `${URL}alms/${alm_sn}/state`,
			headers: {
				'x-im-context-id': `${contextId}`
			},
			data: { state: 'pause' }
		}).then(res => {
			this.log.debug('pause res: ' + res.data);
		}).catch(err => {
			this.log.error('error in pause request: ' + err);
		});
		this.clearAlerts();
		this.refreshState(false);
	}

	private refreshState(force: boolean): void{
		if (connected && (botIsMoving || force || (currentStateCode == 257 || currentStateCode == 260))) { // if bot moves or is charging, get data. Prevents weaking up the bot
			this.getOperatingData();
		}
		if(connected && (requestRunning == false || force)) {
			requestRunning = true;
			let timeout = 30000;
			let last = currentStateCode;
			if (last == undefined) {
				last = 0;
			}
			let forceUrl = '';
			if (refreshMode == 1 || force == true) {
				this.log.debug('state - force - refreshMode: ' + refreshMode);
				forceUrl = '?cached=false&force=true';
			} else {
				this.log.debug('refresh state - longPoll - refreshMode: ' + refreshMode);
				timeout = 3650000;
				forceUrl = `?longpoll=true&timeout=3600&last=${last}`;
			}
			axios({
				method: 'GET',
				url: `${URL}alms/${alm_sn}/state${forceUrl}`,
				headers: {
					'x-im-context-id': `${contextId}`
				},
				timeout: timeout
			}).then(async res => {
				requestRunning = false;
				this.log.debug('[State Data] ' + JSON.stringify(res.data));

				await this.setStateAsync('state.state', { val: res.data.state, ack: true });
				await this.setStateAsync('state.map_update_available', { val: res.data.map_update_available, ack: true });
				if (typeof(res.data.mowed) !== 'undefined') {
					await this.setStateAsync('state.mowed', { val: res.data.mowed, ack: true });
					await this.setStateAsync('state.mowmode', { val: res.data.mowmode, ack: true });
					await this.setStateAsync('state.xPos', { val: res.data.xPos, ack: true });
					await this.setStateAsync('state.yPos', { val: res.data.yPos, ack: true });
					await this.setStateAsync('state.runtime.total.operate', { val: res.data.runtime.total.operate, ack: true });
					await this.setStateAsync('state.runtime.total.charge', { val: res.data.runtime.total.charge, ack: true });
					await this.setStateAsync('state.runtime.session.operate', { val: res.data.runtime.session.operate, ack: true });
					await this.setStateAsync('state.runtime.session.charge', { val: res.data.runtime.session.charge, ack: true });
					await this.setStateAsync('state.config_change', { val: res.data.config_change, ack: true });
					await this.setStateAsync('state.mow_trig', { val: res.data.mow_trig, ack: true });
				}

				await this.setStateAsync('state.mapsvgcache_ts', { val: res.data.mapsvgcache_ts, ack: true });
				await this.setStateAsync('state.svg_xPos', { val: res.data.svg_xPos, ack: true });
				await this.setStateAsync('state.svg_yPos', { val: res.data.svg_yPos, ack: true });


				let stateText = `${res.data.state} - state unknown`;
				let stateUnknow = true;
				for (const state of stateCodes) {
					if (state[0] == res.data.state) {
						stateText = String(state[1]);
						stateUnknow = false;
						if ( state[2] == 1) {
							botIsMoving = true;
							notMovingCount = 0;
						} else {
							if (notMovingCount == 0) {
								// update map, bot stopped
								this.log.info('bot stopped');
								await this.getMap();
								this.createMapWithIndego(res.data.svg_xPos, res.data.svg_yPos);
							}
							notMovingCount = notMovingCount + 1;
							botIsMoving = false;
						}
						// await this.setStateAsync('state.stateText', { val: state[1], ack: true });
						if (state[2] === 1 && firstRun === false) {
							// bot is moving
							this.log.debug('bot is moving, update map');
							await this.getMap();
							this.createMapWithIndego(res.data.svg_xPos, res.data.svg_yPos);
						}
					}
				}
				if (stateUnknow) {
					this.log.warn(stateText + '. Please check the state of the mower in your app and report both to the adapter developer');
				}
				this.getAlerts();
				await this.setStateAsync('state.stateText', { val: stateText, ack: true });
				this.stateCodeChange(res.data.state);
				if (firstRun) {
					firstRun = false;
					await this.getMap();
					this.createMapWithIndego(res.data.svg_xPos, res.data.svg_yPos);
				}
			}).catch(err => {
				requestRunning = false;
				if (typeof err.response !== 'undefined' && err.response.status == 401) {
					// expected behavior after auth is expired -> reconnect
					// this.log.error('connection error'  + JSON.stringify(err));
					connected = false;
					// this.setStateAsync('info.connection', false, true); will be handelt in connect() function on connection failure
					// this.connect(this.config.username, this.config.password, true);
				} else if ((typeof err.response !== 'undefined' && err.response.status == 504) || (typeof err.code !== 'undefined' && err.code == 'ECONNRESET')) {
					// expected behavior by longpoll requests
					this.log.debug('planned longpoll timeout');
				} else {
					// this.log.error('connection error'  + JSON.stringify(err));
					connected = false;
					// this.setStateAsync('info.connection', false, true); will be handelt in connect() function on connection failure
					this.connect(this.config.username, this.config.password, true);
				}

			});
		} else if (requestRunning == false) {
			this.connect(this.config.username, this.config.password, true);
		} else if (requestRunning == true) {
			this.log.debug('longpoll request running');
		}
  	}
	private getMachine(): void{
		if (requestGetMachineData === false) {
			this.log.debug('machine');
			requestGetMachineData = true;
			axios({
				method: 'GET',
				url: `${URL}alms/${alm_sn}`,
				headers: {
					'x-im-context-id': `${contextId}`
				}
			}).then(async res => {
				this.log.debug('[Machine Data] ' + JSON.stringify(res.data));
				requestGetMachineData = false;
				await this.setStateAsync('machine.alm_sn', { val: res.data.alm_sn, ack: true });
				await this.setStateAsync('machine.alm_mode', { val: res.data.alm_mode, ack: true });
				await this.setStateAsync('machine.service_counter', { val: res.data.service_counter, ack: true });
				await this.setStateAsync('machine.needs_service', { val: res.data.needs_service, ack: true });
				await this.setStateAsync('machine.bare_tool_number', { val: res.data.bareToolnumber, ack: true });
				await this.setStateAsync('machine.alm_firmware_version', { val: res.data.alm_firmware_version, ack: true });
			}).catch(err => {
				this.log.error('error in machine request: ' + err);
				connected = false;
				requestGetMachineData = false;
				// this.connect(this.config.username, this.config.password, true);
			});
		} else {
			this.log.debug('skipped - machine request still running');
		}
	}
	private getOperatingData(): void{
		if (requestGetOperationData === false) {
			this.log.debug('operating data');
			requestGetOperationData = true;
			axios({
				method: 'GET',
				url: `${URL}alms/${alm_sn}/operatingData`,
				headers: {
					'x-im-context-id': `${contextId}`
				}
			}).then(async res => {
				this.log.debug('[Operating Data] ' + JSON.stringify(res.data));
				requestGetOperationData = false;
				await this.setStateAsync('operationData.battery.voltage', { val: res.data.battery.voltage, ack: true });
				await this.setStateAsync('operationData.battery.cycles', { val: res.data.battery.cycles, ack: true });
				await this.setStateAsync('operationData.battery.discharge', { val: res.data.battery.discharge, ack: true });
				await this.setStateAsync('operationData.battery.ambient_temp', { val: res.data.battery.ambient_temp, ack: true });
				await this.setStateAsync('operationData.battery.battery_temp', { val: res.data.battery.battery_temp, ack: true });
				await this.setStateAsync('operationData.battery.percent', { val: res.data.battery.percent, ack: true });

				await this.setStateAsync('operationData.garden.signal_id', {val: res.data.garden.signal_id, ack: true });
				await this.setStateAsync('operationData.garden.size', {val: res.data.garden.size, ack: true });
				await this.setStateAsync('operationData.garden.inner_bounds', {val: res.data.garden.inner_bounds, ack: true });
				await this.setStateAsync('operationData.garden.cuts', {val: res.data.garden.cuts, ack: true });
				await this.setStateAsync('operationData.garden.runtime', {val: res.data.garden.runtime, ack: true });
				await this.setStateAsync('operationData.garden.charge', {val: res.data.garden.charge, ack: true });
				await this.setStateAsync('operationData.garden.bumps', {val: res.data.garden.bumps, ack: true });
				await this.setStateAsync('operationData.garden.stops', {val: res.data.garden.stops, ack: true });
				await this.setStateAsync('operationData.garden.last_mow', {val: res.data.garden.last_mow, ack: true });
				await this.setStateAsync('operationData.garden.map_cell_size', {val: res.data.garden.map_cell_size, ack: true });
			}).catch(err => {
				this.log.error('error in operatingData request 2: ' + err);
				connected = false;
				requestGetOperationData = false;
				// this.connect(this.config.username, this.config.password, true);
			});
		} else {
			this.log.debug('skipped - operating data request still running');
		}
	}

	private clearAlerts(): void{
		this.log.debug('clear alerts');
		this.getAlerts().then(async res => {
			const alertArray = res.data;
			if (alertArray.length > 0) {
				await alertArray.forEach((alert: AlertItem) => {
					axios({
						method: 'DELETE',
						url: `${URL}alerts/${alert.alert_id}`,
						headers: {
							'x-im-context-id': `${contextId}`
						},
						data: { state: 'mow' }
					}).then(res2 => {
						this.log.debug('clear alerts: ' + alert.alert_id + ' ' + res2);
					}).catch(err2 => {
						this.log.error('error in clear alerts request: ' + err2);
					});
				})
			}
		}).catch(err => {
			this.log.error('error in clear alerts request: ' + err);
			return Promise.reject(err);
		});
	}

	private async getAlerts(): Promise<any>{
		if (requestGetAlerts === false) {
			requestGetAlerts = true;
			this.log.debug('alerts');
			return axios({
				method: 'GET',
				url: `${URL}alerts`,
				headers: {
					'x-im-context-id': `${contextId}`
				}
			}).then(async res => {
				this.log.debug('[Alert Data] ' + JSON.stringify(res.data));
				requestGetAlerts = false;
				const alertArray = res.data;

				await this.setStateAsync('alerts.list', { val: JSON.stringify(alertArray), ack: true });
				await this.setStateAsync('alerts.count', { val: alertArray.length, ack: true });
				await this.setStateAsync('alerts.error', { val: alertArray.length > 0, ack: true });

				if (alertArray.length > 0) {
					await this.setStateAsync('alerts.last.error_code', { val: alertArray[0].error_code, ack: true });
					await this.setStateAsync('alerts.last.headline', { val: alertArray[0].headline, ack: true });
					await this.setStateAsync('alerts.last.date', { val: alertArray[0].date, ack: true });
					await this.setStateAsync('alerts.last.message', { val: alertArray[0].message, ack: true });
					await this.setStateAsync('alerts.last.flag', { val: alertArray[0].flag, ack: true });
				}
				return res;
			}).catch(err => {
				this.log.error('error in alerts request: ' + err);
				requestGetAlerts = false;
				return Promise.reject(err);
			});
		} else {
			this.log.debug('skipped - alerts request still running');
		}
	}


	private async getMap(): Promise<void>{
		if (requestGetMap === false ) {
			requestGetMap = true;
			this.log.debug('get map');
			axios({
				method: 'GET',
				url: `${URL}alms/${alm_sn}/map?cached=false&force=true`,
				headers: {
					'x-im-context-id': `${contextId}`
				}
			}).then(async res => {
				await this.setStateAsync('map.mapSVG', { val: res.data, ack: true });
				requestGetMap = false;
			}).catch(err => {
				this.log.error('error in map request: ' + err);
				connected = false;
				requestGetMap = false;
				// this.setStateAsync('info.connection', false, true); will be handelt in connect() function on connection failure
				// this.connect(this.config.username, this.config.password, true);
			});
			return;
		} else {
			this.log.debug('skipped - get map request still running');
		}
	}

	private async createMapWithIndego(x: number, y:number): Promise<void> {

		const temp2map = this.getStateAsync('map.mapSVG');
		temp2map.then(async result => {
			if (result?.val) {
				let tempMap = result?.val.toString();
				tempMap = tempMap.substr(0,tempMap.length-6);
				tempMap = tempMap + `<circle cx="${x}" cy="${y}" r="20" stroke="black" stroke-width="3" fill="yellow" /></svg>`;
				const tempMapBlack = tempMap.replace('ry="0" fill="#FAFAFA"','ry="0" fill="#000" fill-opacity="0.0"');
				await this.setStateAsync('map.mapSVGwithIndego', { val: tempMapBlack, ack: true });
			}

		})
		return;
	}

	private  async stateCodeChange(state: number):  Promise<void> {
		this.log.debug('State: ' + state);

		if (currentStateCode != state) {
			this.getMachine();
			if ( state == 260) {
				firstRun = true; // get current location when returned to dock
			}
		}
		if (botIsMoving == false) { //state == 258
			refreshMode = 2;
			const d = new Date();
			const n = d.getHours();
			if (n >= 22 || n < 8) {
				refreshMode = 3;
			}
		} else {
			refreshMode = 1;
		}
		currentStateCode = state;
	}

}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Boschindego(options);
} else {
	// otherwise start the instance directly
	(() => new Boschindego())();
}
