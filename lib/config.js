
const mqtt = require('mqtt')
const validator = require('validator')
const _ = require('lodash')
const config = require('config')
const EventEmitter = require('events')

module.exports = class Config extends EventEmitter {

    constructor(connect) {
        super();
        connect.options.clientId = 'STPresenceConfig_' + (1+Math.random()*4294967295).toString(16);
        this.client  = mqtt.connect(connect.brokerUrl, connect.options);
        this.client.on('connect', () => {
            console.log("Got connect from MQTT client")
            this.emit("connect")
        })
        this.client.on('close', function () {
            console.log("Got close from MQTT client")
            this.emit('close')
        })
    }

    publish(map) {
        this.client.publish('/presence-scanner/config', JSON.stringify(map), { qos: 1, retain: true }, (err) => {
            console.log("MQTT published")
            if (!err) 
                this.emit("published")
        })
    }

    end() {
        console.log("end called")
        this.client.end();
    }
}
