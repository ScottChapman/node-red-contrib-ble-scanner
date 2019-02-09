const mqtt = require('mqtt')
var bluetooth = require('./bluetoothctl.js');
var os = require('os');
const startDelay = 20;
const stopDelay = 15;
const EventEmitter = require('events')

module.exports = class Scanner extends EventEmitter {
    constructor(connect,map) {
        super();
        var obj = this;
        console.log("Connect: ");
        console.dir(connect);
        console.log("map:")
        console.dir(map)
        connect.options.clientId = 'STPresenceScan_' + (1+Math.random()*4294967295).toString(16);
        this.client  = mqtt.connect(connect.brokerUrl, connect.options);
        this.bluetooth = new bluetooth();
        this.machineId = os.hostname();
        this.map = map;
        this.client.on('connect', function () {
            console.log("connected")
            obj.client.subscribe('/presence-scanner/config');
        })
    
        this.client.on('message', (topic,message) => {
            console.log("Updated config")
            map = JSON.parse(message);
            console.dir(map)
        });
    
        this.client.on('close', function () {
            if (obj.interval)
                clearInterval(obj.interval);
            if (obj.timeout)
                clearTimeout(obj.timeout)
            console.log("Disconnected")
        })

        this.bluetooth.on('device', device => {
            console.log("Found device: " + JSON.stringify(device))
            if (obj.map && obj.map.hasOwnProperty(device.uuid)) {
                console.log("Found device I was looking for...")
                // Generate output event
                var obj = {
                    host: obj.machineId,
                    timestamp: new Date().getTime(),
                    payload: {
                        bluetooth: device,
                        smartthing: {
                            name: obj.map[device.uuid]
                        }
                    }

                }
                obj.client.publish('/presence-scanner/devices',JSON.stringify(obj), {qos: 1, retain: false})
                obj.emit('device', obj);
            }
        });
    }

    // Take care of starting the scan and sending the status message
    startScan() {
        this.scanner.spawn();
        console.log("Inside startScan")
        if (!this.scanning) {
            // start the scan
            console.log("Scanning for BLEs started.");
            this.scanner.scanOn()
            this.emit("scanning");
            this.scanning = true;
        }
    }
    
    // Take care of stopping the scan and sending the status message
    stopScan() {
        console.log("Inside stopScan")
        if (this.scanning) {
            // stop the scan
            this.scanner.exit();
            console.log('BLE scanning stopped.');
            this.emit("stopped")
            this.scanning = false;
        }
    }
    
    startScanning() {
        var obj = this;
        console.log("StartScanning")
        this.scanIteration()
        this.interval = setInterval(() => {
            // send heartbeat
            obj.client.publish('/presence-scanner/heartbeat', JSON.stringify({
                host: obj.machineId,
                timestamp: new Date().getTime() 
            }),{qos: 1, retain: false})
            if (obj.map) {
                console.log("interval")
                this.scanIteration();
            }
            delete obj.interval;
        },startDelay * 1000)
    }
    
    scanIteration() {
        var obj = this;
        console.log("ScanIteration")
        return new Promise((resolve,reject) => {
            console.log("Scan iteration start")
            this.startScan();
            obj.timeout = setTimeout(() => {
                console.log("Scan iteration stop")
                this.stopScan()
                delete obj.timeout;
                resolve();
            },stopDelay*1000)
        })
    }
}
