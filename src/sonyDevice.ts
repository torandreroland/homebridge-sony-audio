/* eslint-disable max-len */
import { URL } from 'url';
import { GenericApiError, ApiRequestCurrentExternalTerminalsStatusv1_0, ApiRequestCurrentExternalTerminalsStatusv1_2, ApiRequestSupportedApiInfo, ApiRequestSystemInformationv1_4, ApiRequestSystemInformationv1_6, UnsupportedVersionApiError, ApiResponceSwitchNotifications, ApiNotificationResponce, NotificationMethods, ApiResponceNotifyVolumeInformation, ApiResponceNotifyPowerStatus, ApiResponceNotifyPlayingContentInfo, ApiRequestGetPowerStatus, VolumeInformation, ApiRequestVolumeInformation, ApiResponcePowerStatus, ExternalTerminal, ApiResponceExternalTerminalStatus, ApiResponceVolumeInformation, ApiResponceNotifyExternalTerminalStatus, ApiRequestSetAudioVolume, ApiRequestSetPowerStatus, ApiRequestSetAudioMute, ApiRequestSetPlayContent, ApiRequestPlayingContentInfo, ApiResponcePlayingContentInfo, TerminalTypeMeta, ApiRequestGetSchemeList, ApiResponceSchemeList, ApiRequestPausePlayingContent, ApiRequestGetInterfaceInformation, ApiResponceInterfaceInformation, IncompatibleDeviceCategoryError, ApiNotification } from './api';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Logger } from 'homebridge';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

/**
 * A class of the system info of the device.  
 * Docs [here](https://developer.sony.com/develop/audio-control-api/api-references/api-overview-2#_getsysteminformation_v1_4)
 */
export interface SonyDeviceSystemInformation {
  /**
   * The country code for the device, as a ISO 3166-1 alpha-3 three-letter country code, or "" if it is undefined.
   */
  area: string;
  /**
   * The Bluetooth address of the device.
   */
  bdAddr: string;
  /**
   * The Bluetooth Low Energy ID for the device, or "" if it is not available.
   * This is a 32 bit hash value generated from the Bluetooth address.
   */
  bleID: string;
  /**
   * The server device ID for associating system log data to this device, or "" if it is undefined.
   */
  cid: string;
  /**
   * The general device ID for the device, or "" it if is not available.
   */
  deviceID: string;
  /**
   * The support DUID (DHCP Unique Identifier) for the device, or "" it if is not available.
   * A client can use the DUID to get an IP address from a DHCPv6 server.
   */
  duid: string;
  /**
   * Model name (10 joists) and ID (22 joists) for Netflix.
   */
  esn: string;
  /**
   * The generation number of the device, represented as an X.Y.Z value,
   * where X, Y, and Z are strings composed of letter and number characters; or "" if it is undefined.
   */
  generation: string;
  /**
   * The help URL for the device, or "" it if is undefined.
   */
  helpUrl: string;
  /**
   * The icon URL of the service for the device, or "" if it is undefined.
   */
  iconUrl: string;
  /**
   * The initial power-on time for the device, in ISO8601 format, or "" if it is not available.
   */
  initialPowerOnTime: string;
  /**
   * The language code for the device, as a ISO 3166-1 alpha-3 three-letter country code, or "" if it is undefined.
   */
  language: string;
  /**
   * The last power-on time for the device, in ISO8601 format, or "" if it is not available.
   */
  lastPowerOnTime: string;
  /**
   * The Ethernet MAC address of the device, or "" if it is not available.
   */
  macAddr: string;
  /**
   * The unique name of the product model, or "" if it is undefined.
   */
  model: string;
  /**
   * The product name for the device, or "" if it is not available.
   */
  name: string;
  /**
   * The device category, or "" if it is undefined.
   */
  product: string;
  /**
   * The sales region for the device, as a ISO 3166-1 alpha-3 three-letter country code, or "" if it is undefined.
   */
  region: string;
  /**
   * The serial number of the device, or "" if it is not available.
   */
  serial: string;
  /**
   * The network SSID of the access point to which the device is connected, or "" if it is undefined.
   */
  ssid: string;
  /**
   * Version information for the device, or "" it if is not available.
   */
  version: string;
  /**
   * The wireless MAC address for the device, or "" if it is undefined.
   */
  wirelessMacAddr: string;
}

/**
 * This API provides supported services and its information.
 * This API is used in the initialization sequence to dynamically fetch the service compatibility of server.
 * Docs [here] (https://developer.sony.com/develop/audio-control-api/api-references/api-overview-2#_getsupportedapiinfo_v1_0)
 */
export interface SonyDeviceApiInfo {
  /**
   * Supported APIs.
   */
  apis: {
    /**
     * Name of this API.
     */
    name: string;
    /**
     * Detail of supported versions of this API.
     */
    versions: {
      /**
       * Authentication level of this API.
       */
      authLevel: string;
      /**
       * Transport for this API, if there are any exception from that of belonging service.
       */
      protocols: string;
      /**
       * Version of this API.
       */
      version: string;
    }[];
  }[];
  /**
   * Supported Notification APIs.
   */
  notifications: {
    /**
     * Name of this API.
     */
    name: string;
    /**
     * Detail of supported versions of this API.
     */
    versions: {
      /**
       * Authentication level of this API.
       */
      authLevel: string;
      /**
       * Version of this API.
       */
      version: string;
    }[];
  }[];
  /**
   * Supported transports.
   */
  protocols: string[];
  /**
   * Name of this service.
   */
  service: string;
}

export const enum DEVICE_EVENTS {
  VOLUME = 'volume',
  MUTE = 'mute',
  POWER = 'power',
  SOURCE = 'source',
  /** Emit when device has been restored connection */
  RESTORE = 'restore',
}

type apiRequest = {
  version: string;
  method: string;
};

/**
 * Categories of devices supported by this module
 */
const COMPATIBLE_DEVICE_CATEGORIES = [
  'homeTheaterSystem',
  'personalAudio', // !not tested
];

/**
 * Devices terminals which hasn't in getCurrentExternalTerminalsStatus api
 * from [here](https://developer.sony.com/develop/audio-control-api/api-references/device-uri) 
 */
const DEVICE_TERMINALS: {
  scheme: string;
  /**
   * If `false`, you cannot directly specify the following device resource URIs below
   */
  readonly: boolean;
  terminal: ExternalTerminal;
}[] = [
  {
    scheme: 'dlna',
    readonly: true,
    terminal: {
      connection: 'connected',
      title: 'DLNA Music',
      uri: 'dlna:music',
      meta: TerminalTypeMeta.PC,
    },
  },
  {
    scheme: 'storage',
    readonly: true,
    terminal: {
      connection: 'connected',
      title: 'USB Storage',
      uri: 'storage:usb1',
      meta: TerminalTypeMeta.USBDAC,
    },
  },
  {
    scheme: 'radio',
    readonly: true,
    terminal: {
      connection: 'connected',
      title: 'FM Radio',
      uri: 'radio:fm',
      meta: TerminalTypeMeta.TUNER,
    },
  },
  {
    scheme: 'netService',
    readonly: false,
    terminal: {
      connection: 'connected',
      title: 'Audio Network',
      uri: 'netService:audio',
      meta: TerminalTypeMeta.SOURCE,
    },
  },
  {
    scheme: 'multiroom',
    readonly: false,
    terminal: {
      connection: 'connected',
      title: 'Multiroom Audio',
      uri: 'multiroom:audio',
      meta: TerminalTypeMeta.SOURCE,
    },
  },
  {
    scheme: 'cast',
    readonly: false,
    terminal: {
      connection: 'connected',
      title: 'Cast Audio',
      uri: 'cast:audio',
      meta: TerminalTypeMeta.SOURCE,
    },
  },
  {
    scheme: 'extInput',
    readonly: false,
    terminal: {
      connection: 'connected',
      title: 'AirPlay',
      uri: 'extInput:airPlay',
      meta: TerminalTypeMeta.BTAUDIO,
    },
  },
];

const RE_EXT_OUTPUT = new RegExp('extOutput:*');

const SUBSCRIBE_NOTIFICATIONS = [
  {
    service: 'system',
    notifications: [
      NotificationMethods.POWER,
    ],
  },
  {
    service: 'audio',
    notifications: [
      NotificationMethods.VOLUME,
    ],
  },
  {
    service: 'avContent',
    notifications: [
      NotificationMethods.TERMINAL,
      NotificationMethods.CONTENT,
    ],
  },
];

const RECONNECT_TIMEOUT = 5000;
const REQUEST_TIMEOUT = 5000;
const WEBSOCKET_REQUEST_TIMEOUT = 3000;
const WEBSOCKET_HEARTBEAT_INTERVAL = 60 * 1000;


export class SonyDevice extends EventEmitter {
  private readonly log: Logger;
  /** The device is creating. */
  static CREATING = 0;
  /** The device is ready to communicate. */
  static READY = 1;
  /** The device is in the process of closing. */
  static CLOSING = 2;
  /** The current state of the device */
  private readyState:
    | typeof SonyDevice.CREATING
    | typeof SonyDevice.READY
    | typeof SonyDevice.CLOSING;

  /** Flag for emitting of the RESORE event, rised when connection has been lost and after restored */
  private emitRestoreEvent = false;

  public systemInfo: SonyDeviceSystemInformation = {
    area: '',
    bdAddr: '',
    bleID: '',
    cid: '',
    deviceID: '',
    duid: '',
    esn: '',
    generation: '',
    helpUrl: '',
    iconUrl: '',
    initialPowerOnTime: '',
    language: '',
    lastPowerOnTime: '',
    macAddr: '',
    model: '',
    name: '',
    product: '',
    region: '',
    serial: '',
    ssid: '',
    version: '',
    wirelessMacAddr: '',
  };

  public apisInfo: SonyDeviceApiInfo[];
  private _externalTerminals: ExternalTerminal[] | null = null;
  private _volumeInformation: VolumeInformation[] | null = null;
  
  private axiosInstance: AxiosInstance;
  private axiosInstanceSoap?: AxiosInstance;
  private wsClients: Map<string, WebSocket>;

  public baseUrl: URL;
  public upnpUrl?: URL;
  public UDN: string;
  public manufacturer = 'Sony Corporation';

  private constructor(baseUrl: URL, upnpUrl: URL | undefined, udn: string, apisInfo: SonyDeviceApiInfo[], log: Logger) {
    super();
    this.readyState = SonyDevice.CREATING;
    this.baseUrl = baseUrl;
    this.upnpUrl = upnpUrl;
    this.UDN = udn;
    this.apisInfo = apisInfo;
    this.log = log;
    // this.systemInfo = systemInfo;

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl.href,
      headers: { 'content-type': 'application/json' },
      timeout: REQUEST_TIMEOUT,
    });
    this.axiosInstance.interceptors.response.use(SonyDevice.responseInterceptor(this.log));
    this.axiosInstance.interceptors.request.use(SonyDevice.requestInterceptorLogger(this.log));

    if (this.upnpUrl) {
      this.axiosInstanceSoap = axios.create({
        baseURL: this.upnpUrl.href,
        headers: {
          'SOAPACTION': '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"', 
          'Content-Type': 'text/xml; charset="utf-8"',
        },
        timeout: REQUEST_TIMEOUT,
      });
      this.axiosInstanceSoap.interceptors.response.use(SonyDevice.responseInterceptor(this.log));
      this.axiosInstanceSoap.interceptors.request.use(SonyDevice.requestInterceptorLogger(this.log));
    }
    this.wsClients = new Map<string, WebSocket>();
    this.readyState = SonyDevice.READY;
  }

  /**
   * Return device id
   */
  public getDeviceID() {
    return this.systemInfo.serial !== '' ? this.systemInfo.serial :
      this.systemInfo.macAddr !== '' ? this.systemInfo.macAddr :
        this.systemInfo.wirelessMacAddr;
  }

  /**
   * Checks the request for API version compliance
   */
  public validateRequest(service: string, request: apiRequest): boolean {
    const version = request.version;
    const method = request.method;

    const reqApis = this.apisInfo?.find(a => a.service === service);
    const reqApi = reqApis?.apis.find(m => m.name === method);
    const validVersions = reqApi?.versions.map(x => x.version);
    if (validVersions) {
      return validVersions.includes(version);
    } else {
      return false;
    }
  }

  public async getExternalTerminals(): Promise<ExternalTerminal[] | null> {
    if (!this._externalTerminals) {
      // get the terminals info from device

      const serviceApiInfo = this.apisInfo.find(v => v.service === 'avContent');
      let currentExternalTerminalsVersion: string | null = null;
    
      const api = serviceApiInfo?.apis.find(api => api.name === 'getCurrentExternalTerminalsStatus');
      if (api) {
        currentExternalTerminalsVersion = api.versions?.[0]?.version || null;
      }
   
      const resTerminals = currentExternalTerminalsVersion === '1.2'
        ? await this.axiosInstance.post('/avContent', JSON.stringify(ApiRequestCurrentExternalTerminalsStatusv1_2))
        : await this.axiosInstance.post('/avContent', JSON.stringify(ApiRequestCurrentExternalTerminalsStatusv1_0));
      const terminals = resTerminals.data as unknown as ApiResponceExternalTerminalStatus;
      this._externalTerminals = terminals.result[0];
      // add other terminals
      const schemes = await this.getSchemes();
      DEVICE_TERMINALS.forEach(t => {
        if (t.readonly) {
          if (schemes.includes(t.scheme)) { // device support that input terminal
            this._externalTerminals?.push(t.terminal);
          }
        } else { // add all readonly terminals
          this._externalTerminals?.push(t.terminal);
        }
      });
    }
    return this._externalTerminals;
  }

  /**
   * Terminal is read-only and cannot be select by the user?
   */
  public isReadonlyTerminal(terminal: ExternalTerminal): boolean {
    const readonlyTerminalsUri = DEVICE_TERMINALS.find(t => !t.readonly && t.terminal.uri === terminal.uri);
    return !!readonlyTerminalsUri;
  }

  public async getVolumeInformation(): Promise<VolumeInformation[] | null> {
    if (!this._volumeInformation) {
      // get the volume info from device
      const resVolumes = await this.axiosInstance.post('/audio', JSON.stringify(ApiRequestVolumeInformation));
      const volumes = resVolumes.data as unknown as ApiResponceVolumeInformation;
      this._volumeInformation = volumes.result[0];
    }
    return this._volumeInformation;
  }

  /**
   * Returns the active input (if exist) for current active zone
   */
  public async getActiveInput(): Promise<ExternalTerminal | null> {
    const service = 'avContent';
    const req: ApiRequestPlayingContentInfo = {
      id: 37,
      method: 'getPlayingContentInfo',
      params: [ {} ],
      version: '1.2',
    };
    const zone = await this.getActiveZone();
    if (zone) {
      req.params[0].output = zone.uri;
    }
    const res = await this.axiosInstance.post('/' + service, JSON.stringify(req));
    const playingInfo = res.data as ApiResponcePlayingContentInfo;
    if (playingInfo.result[0].length === 1) { // info with only one zone
      return this.getTerminalBySource(playingInfo.result[0][0].source || playingInfo.result[0][0].uri);
    }
    return null; // no active zone
  }

  /**
   * Return external terminals which are inputs
   */
  public async getInputs():Promise<ExternalTerminal[]> {
    const exTerminals = await this.getExternalTerminals();
    const inputs = exTerminals?.filter(t => !RE_EXT_OUTPUT.test(t.uri));
    return inputs ? inputs : [];
  }

  /**
   * Return external terminals which are zone, aka outputs
   */
  public async getZones():Promise<ExternalTerminal[] | null> {
    const exTerminals = await this.getExternalTerminals();
    const inputs = exTerminals?.filter(t => RE_EXT_OUTPUT.test(t.uri));
    return inputs ? inputs : null;
  }

  /**
   * Return active zone.
   * If no active zone, return `null`.
   * It's mean that only one zone exist, i.e. no output terminals
   */
  public async getActiveZone():Promise<ExternalTerminal | null> {
    const zones = await this.getZones();
    if (zones === null) {
      return null;
    } else {
      const activeZone = zones.find(zone => zone.active === 'active');
      return activeZone ? activeZone : null;
    }
  }

  /**
   * Return the list of schemes that device can handle.
   */
  private async getSchemes(): Promise<string[]> {
    const resSchemes = await this.axiosInstance.post('/avContent', JSON.stringify(ApiRequestGetSchemeList));
    const schemes = resSchemes.data as unknown as ApiResponceSchemeList;
    return schemes.result[0].map(s => s.scheme);
  }

  /**
   * Check the API response for returned error  
   * Decsription of errors [here](https://developer.sony.com/develop/audio-control-api/api-references/error-codes).
   * @param response
   */
  static responseInterceptor(log: Logger) {
    return (response: AxiosResponse) => {
      log.debug(`Response from device:\n${JSON.stringify(response.data)}`);
      if (typeof response.data === 'object' && response.data !== null) {
        if ('error' in response.data) {
          // TODO: add a device ip address for identification of the device
          const errMsg = `Device API got an error: ${JSON.stringify(response.data)}`;
          return Promise.reject(new GenericApiError(errMsg));
        } else {
          return response;
        }
      } else {
        return response;
      }
    };
  }

  /**
   * Logging requests for debug  
   * @param request
   */
  static requestInterceptorLogger(log: Logger) {
    return (request: AxiosRequestConfig) => {
      log.debug(`Request to device\n${request.baseURL}:\n${JSON.stringify(request.data)}`);
      return request;
    };
  }

  /**
   * Create and initialize the new device.  
   * Get info about supported api and system
   */
  public static async createDevice(baseUrl: URL, upnpUrl: URL | undefined, udn: string, log: Logger) {
    const axiosInstance = axios.create({
      baseURL: baseUrl.href,
      headers: { 'content-type': 'application/json' },
      timeout: 0, // when device is turning on, some time it has long answer time.
    });
    axiosInstance.interceptors.response.use(SonyDevice.responseInterceptor(log));
    axiosInstance.interceptors.request.use(SonyDevice.requestInterceptorLogger(log));

    // Checks the device against a compatible category of the device
    const resInterfaceInfo = await axiosInstance.post('/system', JSON.stringify(ApiRequestGetInterfaceInformation));
    const interfaceInfo = resInterfaceInfo.data as ApiResponceInterfaceInformation;
    if (!COMPATIBLE_DEVICE_CATEGORIES.includes(interfaceInfo.result[0].productCategory)) {
      // device has an incompatible category
      throw new IncompatibleDeviceCategoryError(`Device at ${baseUrl.href} has an incompatible category "${interfaceInfo.result[0].productCategory}"`);
    }

    const resApiInfo = await axiosInstance.post('/guide', JSON.stringify(ApiRequestSupportedApiInfo));
    const apisInfo = resApiInfo.data.result[0];

    let systemInformationVersion = null;

    const serviceApiInfo = apisInfo.find(v => v.service === 'system');  
    const api = serviceApiInfo.apis.find(api => api.name === 'getSystemInformation');
    if (api) {
      systemInformationVersion = api.versions?.[0]?.version || null;
    }
 
    const ApiRequestSystemInformation = systemInformationVersion === '1.6' ? ApiRequestSystemInformationv1_6 : ApiRequestSystemInformationv1_4;

    const device = new SonyDevice(baseUrl, upnpUrl, udn, apisInfo, log);
    
    // Gets general system information for the device.
    // check the request for API version compliance
    const service = 'system';
    if (!device.validateRequest(service, ApiRequestSystemInformation)) {
      throw new UnsupportedVersionApiError(`The specified api version is not supported by the device ${baseUrl.hostname}`);
    }
    const resSystemInfo = await axiosInstance.post('/' + service, JSON.stringify(ApiRequestSystemInformation));
    const systemInfo = resSystemInfo.data.result[0];
    Object.assign(device.systemInfo, systemInfo);

    device.subscribe();
    return device;
  }

  /**
   * Initialize notifications for given events
   */
  public subscribe() {
    SUBSCRIBE_NOTIFICATIONS.forEach(subscriber => this.createWebSocket(subscriber.service));
  }

  /**
   * Disable all notifications subscriptions and close websocket connections
   */
  public unsubscribe() {
    this.readyState = SonyDevice.CLOSING;
    this.wsClients.forEach((ws, service) => {
      this.log.debug(`Device ${this.systemInfo.name} unsubscribing from ${service} service`);
      // unsubscribe from all notifications
      const disables = this.getAvailibleNotifications(service);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(this.switchNotifications(100, disables, [])));
      }
    });
  }

  /**
   * Create a new socket for the given service.  
   * If socket already exist, only request current notifications subscriptions
   * @param service 
   * @returns 
   */
  private createWebSocket(service: string): void {
    if (this.wsClients.has(service)) {
      // if socket already created, request current notifications subscriptions
      const ws = this.wsClients.get(service)!;
      if (ws['subscriptionCommand']) {
        ws.send(ws['subscriptionCommand']);
      }
      return;
    }
    const url = new URL(this.baseUrl.href);
    url.protocol = 'ws';
    url.pathname = url.pathname + '/' + service;
    const ws = new WebSocket(url);

    function heartbeat(device: SonyDevice) {
      device.log.debug(`Device ${device.systemInfo.name} heartbeat init`);
      ws['isAlive'] = true;
      ws['heartbeat'] = setInterval(() => {
        if (ws['isAlive'] === false) {
          ws.terminate();
          return;
        }
        device.log.debug(`Device ${device.systemInfo.name} heartbeat`);
        if (ws['subscriptionCommand']) {
          ws.send(ws['subscriptionCommand']);
        }
        ws['heartbeatTimeout'] = setTimeout(() => {
          device.log.debug(`Device ${device.systemInfo.name} heartbeat timeout`);
          ws['isAlive'] = false;
          ws.terminate();
        }, WEBSOCKET_REQUEST_TIMEOUT);
      }, WEBSOCKET_HEARTBEAT_INTERVAL);
    }

    ws.on('open', () => {
      this.log.debug(`Device ${this.systemInfo.name} opened a socked ${url.href}`);
      heartbeat(this);
      // To get current notification settings, send an empty 'switchNotifications' 
      // message with an ID of '1'
      ws.send(JSON.stringify(this.switchNotifications(1, [], [])));
    });
    ws.on('message', (data) => {
      const response: ApiResponceSwitchNotifications = JSON.parse(data as string);
      if ('id' in response) {
        if (response.id === 1) { // enable notification
          this.log.debug(`Device ${this.systemInfo.name} received initial message ${data as string}`);
          const enabled: ApiNotification[] = []; // response.result[0].enabled;
          const disabled: ApiNotification[] = []; // response.result[0].disabled;
          const shouldEnabled = SUBSCRIBE_NOTIFICATIONS.filter(s => s.service === service)[0].notifications;
          // if shouldEnabled equal to returned enabled, this mean what nothing to do. All ok
          if (shouldEnabled.length === enabled.length) {
            return;
          } 
          // else we need to resubscribe
          const all_notifications = [...response.result[0].enabled].concat([...response.result[0].disabled]);
          for (let i = 0; i < all_notifications.length; i++) {
            const item = all_notifications[i];
            if (shouldEnabled.includes(item.name as NotificationMethods)) {
              enabled.push(item);
            } else {
              disabled.push(item);
            }
          }
          if (shouldEnabled.length !== enabled.length) { // something wrong... or not. For example HT-ZF9 hasn't a notifyExternalTerminalStatus. See #1
            this.log.debug(`Device ${this.systemInfo.name} does not have the required notifier. Should be ${JSON.stringify(shouldEnabled)}, but found ${JSON.stringify(enabled)}`);
          }

          this.log.debug(`Device ${this.systemInfo.name} sent subscribe message ${JSON.stringify(this.switchNotifications(2, disabled, enabled))}`);
          ws['subscriptionCommand'] = JSON.stringify(this.switchNotifications(2, disabled.length === 0 ? null as never : disabled, enabled));
          ws.send(ws['subscriptionCommand']);

        } else if (response.id === 100) { // unsubscribe from notifications
          clearInterval(ws['heartbeat']);
          clearTimeout(ws['heartbeatTimeout']);
          ws.terminate();
        } else {
          this.log.debug(`Device ${this.systemInfo.name} received subscription status ${data as string}`);
          if (this.emitRestoreEvent) {
            this.emitRestoreEvent = false;
            this.emit(DEVICE_EVENTS.RESTORE);
          }
        }
      } else { // here handle received notification
        this.log.debug(`Device ${this.systemInfo.name} received notification ${data as string}`);
        this.handleNotificationMessage(response as unknown as ApiNotificationResponce);
      }
      clearTimeout(ws['heartbeatTimeout']);
    });
    ws.on('close', () => {
      this.log.debug(`Device ${this.systemInfo.name} socket closed`);
      this.wsClients.delete(service);
      // If the connection was closed illegally, recreate it.
      if (this.readyState !== SonyDevice.CLOSING) {
        setTimeout(() => {
          this.emitRestoreEvent = true;
          this.createWebSocket(service);
        }, RECONNECT_TIMEOUT);
      }
    });
    ws.on('error', (err) => {
      this.log.debug(`ERROR: Device ${this.systemInfo.name} has a comunication error: ${err.message}`);
      if (this.wsClients.has(service)) {
        this.wsClients.get(service)!.terminate();
      }
      this.wsClients.delete(service);
    });

    this.wsClients.set(service, ws);
  }

  /**
   * A switchNotifications Request
   * taken [here](https://developer.sony.com/develop/audio-control-api/get-started/websocket-example#tutorial-step-3)
   * @param id 
   * @param disable 
   * @param enable 
   */
  private switchNotifications(id: number, disable: ApiNotification[], enable: ApiNotification[]){
    return {
      method: 'switchNotifications',
      id: id,
      params: [{
        disabled: disable,
        enabled: enable,
      }],
      version: '1.0',
    };
  }

  /**
   * Returns all availible notifications of the device
   * @param service 
   * @returns 
   */
  private getAvailibleNotifications(service: string): ApiNotification[] {
    const serviceApiInfo = this.apisInfo.find(v => v.service === service);
    if (!serviceApiInfo) {
      return [];
    }
    const notifications: ApiNotification[] = [];
    for (let i = 0; i < serviceApiInfo.notifications.length; i++) {
      const notification = serviceApiInfo.notifications[i];
      for (let j = 0; j < notification.versions.length; j++) {
        const version = notification.versions[j];
        const verNotification = {
          name: notification.name,
          version: version.version,
        };
        notifications.push(verNotification);
      }
    }
    return notifications;
  }

  /**
   * Parse the notification message recieved from device
   * @param message
   */
  private handleNotificationMessage(message: ApiNotificationResponce) {
    switch (message.method) {
      case NotificationMethods.POWER: {
        const msg = message as unknown as ApiResponceNotifyPowerStatus;
        const power = msg.params[0].status === 'active';
        this.emit(DEVICE_EVENTS.POWER, power);
        break;
      }
      case NotificationMethods.VOLUME: {
        const msg = message as unknown as ApiResponceNotifyVolumeInformation;

        const volumeInfo = msg.params[0];
        // update _volumeInformation
        if (this._volumeInformation) {
          const volumeIdx = this._volumeInformation.findIndex(v => v.output === volumeInfo.output);
          if (volumeIdx !== -1) {
            Object.assign(this._volumeInformation[volumeIdx], volumeInfo);
          }
        }

        const mute = volumeInfo.mute === 'on' ? true : volumeInfo.mute === 'off' ? false : null;
        const volume = volumeInfo.volume;
        if (volume !== -1) {
          this.emit(DEVICE_EVENTS.VOLUME, volume);
        }
        if (mute !== null) {
          this.emit(DEVICE_EVENTS.MUTE, mute);
        }
        break;
      }
      case NotificationMethods.CONTENT: {
        // receive like {"method":"notifyPlayingContentInfo","params":[{"contentKind":"input","output":"extOutput:zone?zone=1","source":"extInput:video?port=1","uri":"extInput:video?port=1"}],"version":"1.0"}
        const msg = message as unknown as ApiResponceNotifyPlayingContentInfo;
        const source = msg.params[0].source || msg.params[0].uri; // maybe overcheck
        this.emit(DEVICE_EVENTS.SOURCE, source);
        break;
      }
      case NotificationMethods.TERMINAL: {
        // receive like {"method":"notifyExternalTerminalStatus","params":[{"active":"active","connection":"connected","label":"","uri":"extOutput:zone?zone=1"}],"version":"1.0"}
        const msg = message as unknown as ApiResponceNotifyExternalTerminalStatus;
        // update _externalTerminals
        msg.params.forEach(updateTerminal => {
          if (this._externalTerminals) {
            const terminalIdx = this._externalTerminals.findIndex(t => t.uri === updateTerminal.uri);
            if (terminalIdx !== -1) {
              Object.assign(this._externalTerminals[terminalIdx], updateTerminal);
            } else {
              this._externalTerminals.push(updateTerminal);
            }
          }
        });
        // if the device is turning off from an external source, a notivication about power doesn't sends.
        // so, force the power status check
        this.getPowerState().then((active) => {
          this.emit(DEVICE_EVENTS.POWER, active);
        });
        break;
      }
      default: {
        this.log.error(`Found not implemented notification from device: ${JSON.stringify(message)}`);
        break;
      }
    }
  }

  /**
   * Find a terminal by source name
   * @param source the source name received from notifyPlayingContentInfo event
   */
  public getTerminalBySource(source: string) {
    if (this._externalTerminals === null) {
      return null;
    }
    const terminals = this._externalTerminals.filter(terminal => terminal.uri === source);
    if (terminals.length !== 0) {
      return terminals[0];
    } else {
      return null;
    }
  }

  /**
   * Get current power state.  
   * * `true` if power is on
   */
  public async getPowerState() {
    const service = 'system';
    const resPowerInfo = await this.axiosInstance.post('/' + service, JSON.stringify(ApiRequestGetPowerStatus));
    const powerInfo = resPowerInfo.data as ApiResponcePowerStatus;
    return powerInfo.result[0].status === 'activating' || powerInfo.result[0].status==='active';
  }

  /**
   * Get current volume state with device volume settings
   * Volume state returns only for active zone. If no active zone then returns null
   */
  public async getVolumeState() {
    const service = 'audio';
    const resVolumeInfo = await this.axiosInstance.post('/' + service, JSON.stringify(ApiRequestVolumeInformation));
    const volumeInfo = resVolumeInfo.data as ApiResponceVolumeInformation;
    const activeZone = await this.getActiveZone();
    if (activeZone) {
      const volumeActiveZone = volumeInfo.result[0].find(vi => vi.output === activeZone.uri);
      if (volumeActiveZone) {
        return volumeActiveZone;
      }
    }
    return null; // no active zone
  }

  /**
   * Change the audio volume level for the active output zone
   * @param volumeSelector the same as Characteristic.VolumeSelector in homebridge
   * * `0` - increment
   * * `1` - decrement
   */
  public async setVolume(volumeSelector: 0 | 1) {
    const service = 'audio';
    const zone = await this.getActiveZone();
    const reqSetVolume: ApiRequestSetAudioVolume = {
      id: 98,
      method: 'setAudioVolume',
      params: [
        {
          output: zone ? zone.uri : '',
          volume: volumeSelector === 0 ? '+1' : '-1',
        },
      ],
      version: '1.1',
    };
    await this.axiosInstance.post('/' + service, JSON.stringify(reqSetVolume));
    return volumeSelector;
  }

  public async setVolumeAbsolute(value: number) {
    const service = 'audio';
    const zone = await this.getActiveZone();
    const reqSetVolume: ApiRequestSetAudioVolume = {
      id: 98,
      method: 'setAudioVolume',
      params: [
        {
          output: zone ? zone.uri : '',
          volume: String(value),
        },
      ],
      version: '1.1',
    };
    await this.axiosInstance.post('/' + service, JSON.stringify(reqSetVolume));
    return value;
  }

  /**
   * Sets the power status of the device.
   * @param power
   * * `true` - set device in the power-on state
   * * `false` - set device in the power-off state
   */
  public async setPower(power: boolean) {
    const service = 'system';
    const reqSetPower: ApiRequestSetPowerStatus = {
      id: 55,
      method: 'setPowerStatus',
      params: [
        {
          status: power ? 'active' : 'off',
        },
      ],
      version: '1.1',
    };
    await this.axiosInstance.post('/' + service, JSON.stringify(reqSetPower));
    return power;
  }

  /**
   * Sets the audio mute status.
   * @param mute 
   * * `true` - muted
   * * `false` - not muted
   */
  public async setMute(mute: boolean) {
    const service = 'audio';
    const zone = await this.getActiveZone();
    const reqSetMute: ApiRequestSetAudioMute = {
      id: 601,
      method: 'setAudioMute',
      params: [
        {
          mute: mute ? 'on' : 'off',
        },
      ],
      version: '1.1',
    };
    if (zone) {
      reqSetMute.params[0].output = zone.uri;
    }
    await this.axiosInstance.post('/' + service, JSON.stringify(reqSetMute));
    return mute;
  }

  /**
   * Sets the input source
   * @param terminal 
   */
  public async setSource(terminal: ExternalTerminal) {
    const service = 'avContent';
    const zone = await this.getActiveZone();
    const reqSetPlayContent: ApiRequestSetPlayContent = {
      id: 47,
      method: 'setPlayContent',
      params: [
        {
          uri: terminal.uri,
        },
      ],
      version: '1.2',
    };
    if (zone) {
      reqSetPlayContent.params[0].output = zone.uri;
    }

    await this.axiosInstance.post('/' + service, JSON.stringify(reqSetPlayContent));
    return terminal;
  }

  /**
   * Toggles between the play and pause states for the current content.
   */
  public async setPause() {
    const service = 'avContent';
    const zone = await this.getActiveZone();
    const reqPausePlayingContent: ApiRequestPausePlayingContent = {
      id: 31,
      method: 'pausePlayingContent',
      params: [ {} ],
      version: '1.1',
    };
    if (zone) {
      reqPausePlayingContent.params[0].output = zone.uri;
    }
    await this.axiosInstance.post('/' + service, JSON.stringify(reqPausePlayingContent));
    return;
  }

  /**
   * Sends command codes of IR remote commander to device via IP  
   * Some info [here](https://pro-bravia.sony.net/develop/integrate/ircc-ip/overview/index.html)
   * @param irCode 
   */
  public async sendIRCC(irCode: string) {
    if (this.axiosInstanceSoap) {
      const data = `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1"><IRCCCode>${irCode}</IRCCCode></u:X_SendIRCC></s:Body></s:Envelope>`;
      await this.axiosInstanceSoap.post('', data);
    }
  }

  /**
   * Press Arrow Up to select the menu items
   * @returns 
   */
  public async setUp() {
    const irccCode = 'AAAAAgAAALAAAAB4AQ==';
    return this.sendIRCC(irccCode);
  }
  
  /**
   * Press Arrow Down to select the menu items
   * @returns 
   */
  public async setDown() {
    const irccCode = 'AAAAAgAAALAAAAB5AQ==';
    return this.sendIRCC(irccCode);
  }

  /**
   * Press Arrow Right to select the menu items
   * @returns 
   */
  public async setRigth() {
    const irccCode = 'AAAAAgAAALAAAAB7AQ==';
    return this.sendIRCC(irccCode);
  }

  /**
   * Press Arrow Left to select the menu items
   * @returns 
   */
  public async setLeft() {
    const irccCode = 'AAAAAgAAALAAAAB6AQ==';
    return this.sendIRCC(irccCode);
  }

  /**
   * Press Select to enter the selection
   * @returns 
   */
  public async setSelect() {
    const irccCode = 'AAAAAgAAADAAAAAMAQ==';
    return this.sendIRCC(irccCode);
  }

  /**
   * Press Back for returns to the previous menu or exits a menu
   * @returns 
   */
  public async setBack() {
    const irccCode = 'AAAAAwAAARAAAAB9AQ==';
    return this.sendIRCC(irccCode);
  }

  /**
   * Press Information for view some info
   * @returns 
   */
  public async setInformation() {
    const irccCode = 'AAAAAgAAADAAAABTAQ==';
    return this.sendIRCC(irccCode);
  }
}
