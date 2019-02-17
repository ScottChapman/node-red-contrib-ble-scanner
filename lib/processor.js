const _ = require('lodash')
const NodeCache = require( "node-cache" );
const mqtt = require('mqtt')
const EventEmitter = require('events')

module.exports = class Processor extends EventEmitter {
    constructor(connect) {
        super();
        connect.options.clientId = 'STPresenceProcessor_' + (1+Math.random()*4294967295).toString(16);
        this.client  = mqtt.connect(connect.brokerUrl, connect.options);
        this.deviceCache = new NodeCache( { stdTTL: 5*60, checkperiod: 60 } );
        this.hostCache = new NodeCache( { stdTTL: 5*60, checkperiod: 60 } );
        this.initialState = new NodeCache( { stdTTL: 5*60, checkperiod: 60 } );
        this.state_saved = false;
        this.client.subscribe([
            '/presence-scanner/heartbeat',
            '/presence-scanner/devices',
            '/presence-scanner/config',
            '/presence-scanner/state'
        ],(err,granted) => {
            this.emit("listening")
        })
        this.client.on("connect",() => {
            this.emit("connected")
        })
        this.client.on("close",() => {
            this.emit("closed")
        })
        this.client.on("message", (topic,message) => {
            message = JSON.parse(message);
            switch (topic) {
                case '/presence-scanner/heartbeat':
                    // console.log("Got heartbeat");
                    // console.log(JSON.stringify(message))
                    this.hostCache.set(message.host,message);
                    this.emit("heartbeat",message)
                    break;
                case '/presence-scanner/devices':
                    // console.log("Got device")
                    // console.log(JSON.stringify(message))
                    if (!this.deviceCache.get(message.payload.smartthing.name)) {
                        this.present(message.payload.smartthing);
                    }
                    this.deviceCache.set(message.payload.smartthing.name, message);
                    this.emit("device",message.payload.bluetooth.uuid)
                    this.initialState.del(message.payload.bluetooth.uuid)
                    break;
                case '/presence-scanner/state':
                    this.client.unsubscribe('/presence-scanner/state');
                    // console.log("Restoring state")
                    // console.log(JSON.stringify(message))
                    for (var host of _.keys(message.hosts)) {
                        // console.log("Restoring state of host: " + host)
                        this.hostCache.set(host,message.hosts[host])
                    }
                    for (var device of _.keys(message.devices)) {
                        // console.log("Restoring state of device: " + device)
                        this.deviceCache.set(device,message.devices[device])
                    }
                    this.emit("state_restored",message)
                case '/presence-scanner/config':
                    this.client.unsubscribe('/presence-scanner/config');
                    console.log("Got Config")
                    console.log(JSON.stringify(message))
                    for (var uuid of _.keys(message)) {
                        this.initialState.set(uuid, message[uuid]);
                    }
                    this.emit("config_loaded",message)
                    break;
            }
        })
        this.interval = setInterval(() => {
            this.saveState()
        },1*60*1000)
        this.initialState.on("expired",(uuid, name) => {
            console.log("Device: " + name + " not present after initialization")
            notPresent({
                name: name,
                uuid: uuid
            });
        })
    }

    saveState() {
        if (!this.saved_state) 
            this.client.unsubscribe('/presence-scanner/state');
        this.saved_state = true;
        // console.log("Saving state")
        var state = {
            devices: {},
            hosts: {}
        };
        for (var device of this.deviceCache.keys()) {
            // console.log("Saving state of device " + device)
            state.devices[device] = this.deviceCache.get(device);
        }
        for (var host of this.hostCache.keys()) {
            // console.log("Saving state of host " + host)
            state.hosts[host] = this.hostCache.get(host);
        }
        // console.log("Persisting State: " + JSON.stringify(state))
        this.client.publish('/presence-scanner/state', JSON.stringify(state), {
            qos:2,
            retain: true
        })
        this.emit("state_saved",state)
    }

    present(device) {
        console.log("Device: " + device.name + " present")
        var topic = `/smartthings/${device.name}/presence`
        this.client.publish(topic,'present',{
            qos:1,
            retain: false
        })
        this.emit("present",device)
    }

    notPresent(device) {
        console.log("Device: " + device.name + " NOT present")
        var topic = `/smartthings/${device.name}/presence`
        this.client.publish(topic,'not present',{
            qos:1,
            retain: false
        })
        this.emit("not_present",device)
    }

    end() {
        this.client.end();
    }

}