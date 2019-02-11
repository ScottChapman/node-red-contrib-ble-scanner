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
        this.client.subscribe([
            '/presence-scanner/heartbeat',
            '/presence-scanner/devices',
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
                    console.log("Got heartbeat");
                    console.log(JSON.stringify(message))
                    this.hostCache.set(message.host,message);
                    this.emit("heartbeat",message)
                    break;
                case '/presence-scanner/devices':
                    console.log("Got device")
                    console.log(JSON.stringify(message))
                    if (!this.deviceCache.get(message.payload.smartthing.name)) {
                        this.present(message.payload.smartthing);
                    }
                    this.deviceCache.set(message.payload.smartthing.name, message);
                    this.emit("device",message)
                    break;
                case '/presence-scanner/state':
                    console.log("Restoring state")
                    console.log(JSON.stringify(message))
                    for (var host of _.keys(message.hosts)) {
                        console.log("Restoring state of host: " + host)
                        this.hostCache.set(message.hosts[host],host)
                    }
                    for (var device of _.keys(message.devices)) {
                        console.log("Restoring state of device: " + device)
                        this.deviceCache.set(message.devices[device],device)
                    }
                    this.client.unsubscribe('/presence-scanner/state');
                    this.emit("state_restored",message)
                    break;
            }
        })
        this.interval = setInterval(() => {
            this.saveState()
        },1*60*1000)
    }

    saveState() {
        console.log("Saving state")
        var state = {
            devices: {},
            hosts: {}
        };
        for (var device of this.deviceCache.keys()) {
            console.log("Saving state of device " + device)
            state.devices[device] = this.deviceCache.get(device);
        }
        for (var host of this.hostCache.keys()) {
            console.log("Saving state of host " + host)
            state.hosts[host] = this.hostCache.get(host);
        }
        console.log("Persisting State: " + JSON.stringify(state))
        this.client.publish('/precense-scanner/state', JSON.stringify(state), {
            qos:2,
            retain: true
        })
        this.emit("state_saved",state)
    }

    present(device) {
        var topic = `/smartthings/${device.name}/presence`
        this.client.publish(topic,'present',{
            qos:1,
            retain: false
        })
        this.emit("present",device)
    }

    notPresent(device) {
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