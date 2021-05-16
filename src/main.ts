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

let connected = false;
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
	[64513, 'Docked - Waking up',0]
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
		if (this.config.username) {
			this.connect(this.config.username, this.config.password);
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
				type: 'number',
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
				type: 'number',
				min: 0,
				max: 100,
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
				type: 'number',
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
		await this.setObjectNotExistsAsync('machine.bareToolnumber', {
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



		await this.setObjectNotExistsAsync('commands.mow', {
			type: 'state',
			common: {
				name: 'mow',
				type: 'boolean',
				role: 'button',
				read: false,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('commands.goHome', {
			type: 'state',
			common: {
				name: 'goHome',
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
				name: 'pause',
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
		// create channel
		/*
		await this.extendObjectAsync('alerts', {
			type: 'channel',
			common: {
				name: 'alerts',
			},
			native: {},
		});
		*/

		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		this.subscribeStates('commands.mow');
		this.subscribeStates('commands.pause');
		this.subscribeStates('commands.goHome');

		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates('lights.*');
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates('*');

		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
		//await this.setStateAsync('testVariable', true);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		//await this.setStateAsync('testVariable', { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		//await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });
		this.log.info(String(this.config.deepSleepAtNight))

		interval1 = setInterval(()=> {
			if (connected && refreshMode == 1) {
				// this.checkAuth(this.config.username, this.config.password);
				this.state();
			}
			if (connected == false) {
				this.connect(this.config.username, this.config.password);
			}
		}
		,20000)

		interval2 = setInterval(()=> {
			if (connected && refreshMode == 2) {
				this.state();
			}
		}
		,60000)

		interval3 = setInterval(()=> {
			if (connected && refreshMode == 3 && this.config.deepSleepAtNight == false) {
				this.state();
			}
		}
		,1800000)
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 */
	private onUnload(callback: () => void): void {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);
			clearInterval(interval1);
			clearInterval(interval2);
			clearInterval(interval3);
			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  */
	// private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 */
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
			if (id.indexOf('goHome') >= 0) {
				this.goHome();
			}
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  */
	// private onMessage(obj: ioBroker.Message): void {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }

	private connect(username: string,password: string): void {
		this.log.info('connect');
		console.log('connect');
		const buff = Buffer.from(username + ':' + password, 'utf-8');
		const base64 = buff.toString('base64');
		axios({
			method: 'POST',
			url: `${URL}authenticate`,
			headers: {
				'Authorization': `Basic ${base64}`,
				'Content-Type': 'application/json'
			},
			data: {device:'', os_type:'Android', os_version:'4.0', dvc_manuf:'unknown', dvc_type:'unknown'}
		}).then(res => {
			this.log.info('connect ok');
			console.log('connect', res.data);

			contextId = res.data.contextId;
			// userId = res.data.userId;
			alm_sn = res.data.alm_sn;
			connected = true;
			this.setStateAsync('info.connection', true, true);
			this.setForeignState('system.adapter.' + this.namespace + '.alive', true);
			this.state();
		}).catch(err => {
			// this.log.error(JSON.stringify(err));
			this.log.error('connect error');
			console.log('error in request', err);
			this.log.error('connection error - credentials wrong or no network?');
			connected = false;
			this.setStateAsync('info.connection', false, true);
			// this.setForeignState('system.adapter.' + this.namespace + '.alive', false);
			// this.terminate('Connection error. Credentials wrong?',0);
		});
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
			console.log('checkAuth',res);
		}).catch(err => {
			console.log('error in check auth request', err);
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
			console.log('mow res', res.data);
		}).catch(err => {
			console.log('error in mow request', err);
		});
	}

	private goHome(): void{
		console.log('returnToDock');
		this.log.info('return to dock command sent')
		axios({
			method: 'PUT',
			url: `${URL}alms/${alm_sn}/state`,
			headers: {
				'x-im-context-id': `${contextId}`
			},
			data: { state: 'returnToDock' }
		}).then(res => {
			console.log('returnToDock res', res.data);
		}).catch(err => {
			console.log('error in returnToDock request', err);
		});
	}

	private pause(): void{
		console.log('pause');
		this.log.info('pause command sent')
		axios({
			method: 'PUT',
			url: `${URL}alms/${alm_sn}/state`,
			headers: {
				'x-im-context-id': `${contextId}`
			},
			data: { state: 'pause' }
		}).then(res => {
			console.log('pause res', res.data);
		}).catch(err => {
			console.log('error in pause request', err);
		});
	}

	private state(): void{
		console.log('state');
		axios({
			method: 'GET',
			url: `${URL}alms/${alm_sn}/state?cached=false&force=true`,
			headers: {
				'x-im-context-id': `${contextId}`
			}
		}).then(async res => {


			await this.setStateAsync('state.state', { val: res.data.state, ack: true });
			await this.setStateAsync('state.map_update_available', { val: res.data.map_update_available, ack: true });
			await this.setStateAsync('state.mowed', { val: res.data.mowed, ack: true });
			await this.setStateAsync('state.mowmode', { val: res.data.mowmode, ack: true });
			await this.setStateAsync('state.xPos', { val: res.data.xPos, ack: true });
			await this.setStateAsync('state.yPos', { val: res.data.yPos, ack: true });
			await this.setStateAsync('state.runtime.total.operate', { val: res.data.runtime.total.operate, ack: true });
			await this.setStateAsync('state.runtime.total.charge', { val: res.data.runtime.total.charge, ack: true });
			await this.setStateAsync('state.runtime.session.operate', { val: res.data.runtime.session.operate, ack: true });
			await this.setStateAsync('state.runtime.session.charge', { val: res.data.runtime.session.charge, ack: true });
			await this.setStateAsync('state.mapsvgcache_ts', { val: res.data.mapsvgcache_ts, ack: true });
			await this.setStateAsync('state.svg_xPos', { val: res.data.svg_xPos, ack: true });
			await this.setStateAsync('state.svg_yPos', { val: res.data.svg_yPos, ack: true });
			await this.setStateAsync('state.config_change', { val: res.data.config_change, ack: true });
			await this.setStateAsync('state.mow_trig', { val: res.data.mow_trig, ack: true });
			console.log(res.data);

			let stateText = `${res.data.state} - state unknown`;
			let stateUnknow = true;
			for (const state of stateCodes) {
				if (state[0] == res.data.state) {
					stateText = String(state[1]);
					stateUnknow = false;
					if ( state[2] == 1) {
						notMovingCount = 0;
					} else {
						if (notMovingCount == 0) {
							// update map, bot stopped
							this.log.info('bot stopped');
							await this.getMap();
							this.createMapWithIndego(res.data.svg_xPos, res.data.svg_yPos);
						}
						notMovingCount = notMovingCount + 1;
					}
					// await this.setStateAsync('state.stateText', { val: state[1], ack: true });
					if (state[2] === 1 && firstRun === false) {
						// bot is moving
						// console.log('bot is moving, update map');

						await this.getMap();
						this.createMapWithIndego(res.data.svg_xPos, res.data.svg_yPos);
					}
				}
			}
			if (stateUnknow) {
				this.log.warn(stateText + '. Please check the state of the mower in your app and report both to the adapter developer');
			}
			await this.setStateAsync('state.stateText', { val: stateText, ack: true });
			this.stateCodeChange(res.data.state);
			if (firstRun) {
				firstRun = false;
				await this.getMap();
				this.createMapWithIndego(res.data.svg_xPos, res.data.svg_yPos);
			}
		}).catch(err => {
			this.log.error('connection error');
			if (typeof err.response !== 'undefined' && err.response.status == 401) {
				connected = false;
				this.setStateAsync('info.connection', false, true);
				this.connect(this.config.username, this.config.password);
			} else {
				connected = false;
				this.setStateAsync('info.connection', false, true);
				this.connect(this.config.username, this.config.password);
			}

		});
		this.getOperatingData();
  	}
	private getMachine(): void{
		console.log('machine');
		axios({
			method: 'GET',
			url: `${URL}alms/${alm_sn}`,
			headers: {
				'x-im-context-id': `${contextId}`
			}
		}).then(async res => {

			await this.setStateAsync('machine.alm_sn', { val: res.data.alm_sn, ack: true });
			await this.setStateAsync('machine.alm_mode', { val: res.data.alm_mode, ack: true });
			await this.setStateAsync('machine.service_counter', { val: res.data.service_counter, ack: true });
			await this.setStateAsync('machine.needs_service', { val: res.data.needs_service, ack: true });
			await this.setStateAsync('machine.bareToolnumber', { val: res.data.bareToolnumber, ack: true });
			await this.setStateAsync('machine.alm_firmware_version', { val: res.data.alm_firmware_version, ack: true });
		}).catch(err => {
			console.log('error in machine request', err);
		});
	}
	private getOperatingData(): void{
		console.log('operating data');
		axios({
			method: 'GET',
			url: `${URL}alms/${alm_sn}/operatingData`,
			headers: {
				'x-im-context-id': `${contextId}`
			}
		}).then(async res => {

			await this.setStateAsync('operationData.battery.voltage', { val: res.data.battery.voltage, ack: true });
			await this.setStateAsync('operationData.battery.cycles', { val: res.data.battery.cycles, ack: true });
			await this.setStateAsync('operationData.battery.discharge', { val: res.data.battery.discharge, ack: true });
			await this.setStateAsync('operationData.battery.ambient_temp', { val: res.data.battery.ambient_temp, ack: true });
			await this.setStateAsync('operationData.battery.battery_temp', { val: res.data.battery.battery_temp, ack: true });
			await this.setStateAsync('operationData.battery.percent', { val: res.data.battery.percent, ack: true });

		}).catch(err => {
			console.log('error in operatingData request', err);
		});
	}

	private getAlerts(): void{
		console.log('alerts');
		axios({
			method: 'GET',
			url: `${URL}alerts`,
			headers: {
				'x-im-context-id': `${contextId}`
			}
		}).then(async res => {
			const alertArray = res.data;
			const storedAlerts: string[] = [];
			await this.getAdapterObjectsAsync().then(res => {
				const objectKeys = Object.keys(res);
				for (let i = 0; i < objectKeys.length; i++) {
					if (objectKeys[i].indexOf(this.namespace + '.alerts.') === 0 && objectKeys[i].endsWith('alert_id')) {
						this.log.error(JSON.stringify(objectKeys[i]));
						const startString = this.namespace + '.alerts.';
						const alertId = objectKeys[i].substring(
							objectKeys[i].lastIndexOf(startString) + startString.length,
							objectKeys[i].lastIndexOf('.alert_id')
						);
						storedAlerts.push(alertId);
					}
				}
			})
			this.log.info('stored alerts 1: ' + JSON.stringify(storedAlerts));



			if (alertArray.length > 0) {
				this.log.info(alertArray.length);
				await alertArray.forEach((alert:AlertItem) => {
					if (storedAlerts.indexOf(alert.alert_id) >= 0) {
						this.log.info('delete from array: ' + alert.alert_id );
						storedAlerts.splice(storedAlerts.indexOf(alert.alert_id),1);
					} else {
						this.log.info('new Entry');
					}
					this.getObjectAsync('alerts.'+ alert.alert_id).then(async res => {
						if (res === null) {
							this.setObjectNotExistsAsync
							await this.createStateAsync(this.namespace, '.alerts', alert.alert_id, {
								role: 'state',
								type: 'object',
							});

							/*await this.setForeignObjectAsync(this.namespace + '.alerts.'+ alert.alert_id, {
								type: 'state',
								common: {
									name: alert.alert_id,
									role: 'state',
									read: true,
									write: false,
								},
								native: {
								}
							})
							*/
							this.setStateAsync('alerts.'+ alert.alert_id  , { val: alert.error_code, ack: true } )


							// this.createChannelAsync(this.namespace, 'alerts.'+ alert.alert_id);


							/*await this.setForeignObjectAsync(this.namespace +'.alerts.'+ alert.alert_id,
								{
									_id: 'alerts.'+ alert.alert_id,
									type: 'state',
									common: {
										name: alert.headline,
										type: 'string',
										read: true,
										write: false,
										role: 'state'
									},
									native: {}
								}

							)
							this.setStateAsync('alerts.'+ alert.alert_id  , { val: alert.error_code, ack: true } )
							*/

							await this.setForeignObjectAsync(this.namespace + '.alerts.'+ alert.alert_id + '.alert_id',
								{
									type: 'state',
									common: {
										name: 'alert_id',
										read: true,
										write: false,
										role: 'state'
									},
									native: {}
								}

							)
							this.setStateAsync('alerts.'+ alert.alert_id + '.alert_id' , { val: alert.alert_id, ack: true } )
							/*
							await this.setForeignObjectAsync('alerts.'+ alert.alert_id + '.message',
								{
									type: 'state',
									common: {
										name: 'message',
										read: true,
										write: false,
										role: 'state'
									},
									native: {}
								}

							)
							this.setStateAsync('alerts.'+ alert.alert_id + '.message' , { val: alert.message, ack: true } )

							await this.setForeignObjectAsync('alerts.'+ alert.alert_id + '.error_code',
								{
									type: 'state',
									common: {
										name: 'error_code',
										read: true,
										write: false,
										role: 'state'
									},
									native: {}
								}

							)
							this.setStateAsync('alerts.'+ alert.alert_id + '.error_code' , { val: alert.error_code, ack: true } )

							await this.setForeignObjectAsync('alerts.'+ alert.alert_id + '.date',
								{
									type: 'state',
									common: {
										name: 'date',
										read: true,
										write: false,
										role: 'state'
									},
									native: {}
								}

							)
							this.setStateAsync('alerts.'+ alert.alert_id + '.date' , { val: alert.date, ack: true } )

							await this.setForeignObjectAsync('alerts.'+ alert.alert_id + '.read_status',
								{
									type: 'state',
									common: {
										name: 'read_status',
										read: true,
										write: false,
										role: 'state'
									},
									native: {}
								}

							)
							this.setStateAsync('alerts.'+ alert.alert_id + '.read_status' , { val: alert.read_status, ack: true } )

							await this.setForeignObjectAsync('alerts.'+ alert.alert_id + '.flag',
								{
									type: 'state',
									common: {
										name: 'flag',
										read: true,
										write: false,
										role: 'state'
									},
									native: {}
								}

							)
							this.setStateAsync('alerts.'+ alert.alert_id + '.flag' , { val: alert.flag, ack: true } )

							await this.setForeignObjectAsync('alerts.'+ alert.alert_id + '.push',
								{
									type: 'state',
									common: {
										name: 'push',
										read: true,
										write: false,
										role: 'state'
									},
									native: {}
								}

							)
							this.setStateAsync('alerts.'+ alert.alert_id + '.push' , { val: alert.flag, ack: true } )
							*/


						} else {
							this.setStateAsync('alerts.'+ alert.alert_id + '.read_status' , { val: alert.read_status, ack: true } )
							this.setStateAsync('alerts.'+ alert.alert_id + '.push' , { val: alert.flag, ack: true } )
						}
					})
					/*
					this.extendObjectAsync('alerts.'+ alert.alert_id,
						{
							type: 'state',
							common: {
								name: alert.error_code,
								read: true,
								write: false
							}
						}
					)
					this.setState('alerts.'+ alert.alert_id + '.message' , { val: alert.message, ack: true } )
					*/
				})

			}
			this.log.info('stored alerts 2: ' + JSON.stringify(storedAlerts));

			storedAlerts.forEach((alertId) => {
				this.log.info('delete_' + this.namespace + '.alerts.'+ alertId + '.alert_id' + '_');


				this.deleteStateAsync('alerts.'+ alertId + '.alert_id').then(res => {
					this.log.info('delete response: ' + JSON.stringify(res));
				}).catch(err => {
					this.log.error(err);
				})
			})
			// await this.setStateAsync('alerts', { val: res.data, ack: true });
			// console.log(res)
		}).catch(err => {
			console.log('error in alerts request', err);
		});
	}


	private async getMap(): Promise<void>{
		console.log('get map');
		axios({
			method: 'GET',
			url: `${URL}alms/${alm_sn}/map?cached=false&force=true`,
			headers: {
				'x-im-context-id': `${contextId}`
			}
		}).then(async res => {
			await this.setStateAsync('map.mapSVG', { val: res.data, ack: true });
		}).catch(err => {
			console.log('error in map request', err);
		});
		return;
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
		console.log(state);

		if (currentStateCode != state) {
			this.getMachine();
			// this.getAlerts();
			if ( state == 260) {
				firstRun = true; // get current location when returned to dock
			}
		}
		if (state == 258) {
			refreshMode = 2;
			const d = new Date();
			const n = d.getHours();
			if (n >= 22 || n <=8) {
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