const mqtt = require('mqtt')
var bluetooth = require('./bluetoothctl.js');
var os = require('os');
const startDelay = 20;
const stopDelay = 15;
const EventEmitter = require('events')

module.exports = class Scanner extends EventEmitter {
    constructor(connect,map) {
        super();
        connect.options.clientId = 'STPresenceScan_' + (1+Math.random()*4294967295).toString(16);
        this.client  = mqtt.connect(connect.brokerUrl, connect.options);
        this.bluetooth = new bluetooth();
        this.machineId = os.hostname();
        this.map = map;
        this.scanning = false;
        this.client.on('connect', () => {
            this.client.subscribe('/presence-scanner/config');
            this.emit("connected")
        })
    
        this.client.on('message', (topic,message) => {
            console.log("Updated config")
            this.map = JSON.parse(message);
            console.dir(this.map)
        });
    
        this.client.on('close', () => {
            this.stopScan();
            if (this.interval)
                clearInterval(this.interval);
            if (this.timeout)
                clearTimeout(this.timeout)
            this.emit("disconnected")
        })

        this.bluetooth.on('device', device => {
            console.log("Found device: " + JSON.stringify(device))
            if (this.map && this.map.hasOwnProperty(device.uuid)) {
                console.log("Found device I was looking for...")
                // Generate output event
                var obj = {
                    host: this.machineId,
                    timestamp: new Date().getTime(),
                    payload: {
                        bluetooth: device,
                        smartthing: {
                            name: this.map[device.uuid]
                        }
                    }
                }
                this.client.publish('/presence-scanner/devices',JSON.stringify(obj), {qos: 1, retain: false})
                this.emit('device', obj);
            }
        });
        this.bluetooth.spawn();
    }

    // Take care of starting the scan and sending the status message
    startScan() {
        console.log("Inside startScan")
        if (!this.scanning) {
            // start the scan
            console.log("Scanning for BLEs started.");
            this.bluetooth.scanOn()
            this.emit("scanning");
            this.scanning = true;
        }
    }
    
    // Take care of stopping the scan and sending the status message
    stopScan() {
        console.log("Inside stopScan")
        if (this.scanning) {
            // stop the scan
            this.bluetooth.sdanoff();
            console.log('BLE scanning stopped.');
            this.emit("stopped")
            this.scanning = false;
        }
    }
    
    startScanning() {
        console.log("StartScanning")
        console.dir(this.map)
        this.scanIteration()
        this.interval = setInterval(() => {
            // send heartbeat
            this.client.publish('/presence-scanner/heartbeat', JSON.stringify({
                host: this.machineId,
                timestamp: new Date().getTime() 
            }),{qos: 1, retain: false})
            if (this.map) {
                console.log("interval")
                this.scanIteration();
            }
            delete this.interval;
        },startDelay * 1000)
    }
    
    scanIteration() {
        console.log("ScanIteration")
        return new Promise((resolve,reject) => {
            console.log("Scan iteration start")
            this.timeout = setTimeout(() => {
                console.log("Scan iteration stop")
                this.stopScan()
                delete this.timeout;
                resolve();
            },stopDelay*1000)
            this.startScan();
        })
    }

    end() {
        this.client.end();
    }
}
