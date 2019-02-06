/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

const validator = require('validator')
const _ = require('lodash')
const NodeCache = require( "node-cache" );
const mqtt = require('mqtt')
const deviceCache = new NodeCache( { stdTTL: 5*60, checkperiod: 60 } );
const hostCache = new NodeCache( { stdTTL: 5*60, checkperiod: 60 } );

function saveState(node) {
    node.log("Saving state")
    var state = {
        devices: {},
        hosts: {}
    };
    for (var device of deviceCache.keys()) {
        node.log("Saving state of device " + device)
        state.devices[device] = deviceCache.get(device);
    }
    for (var host of hostCache.keys()) {
        node.log("Saving state of host " + host)
        state.hosts[host] = hostCache.get(host);
    }
    node.log("Persisting State: " + JSON.stringify(state))
    node.client.publish('/st-presence/state', JSON.stringify(state), {
        qos:2,
        retain: true
    })
}

function missingHost(node,host) {
    node.error(`Haven't heard from host ${host.host}. Host might be down?`)
}

function present(node,device) {
    node.log(device.name + " present!")
    var topic = `/smartthings/${device.name}/presence`
    node.client.publish(topic,'present',{
        qos:1,
        retain: false
    })
}

function notPresent(node,device) {
    node.log($device.name + " NOT present!")
    var topic = `/smartthings/${device.name}/presence`
    node.client.publish(topic,'not present',{
        qos:1,
        retain: false
    })
}

function listen(node) {
    node.client.subscribe([
        '/presence-scanner/heartbeat',
        '/presence-scanner/devices',
        '/presence-scanner/state'
    ],(err,granted) => {
        node.status({fill: 'green', shape: 'dot', text: 'Listening...'});
    })
    node.client.on("message", (topic,message) => {
        message = JSON.parse(message);
        switch (topic) {
            case '/presence-scanner/heartbeat':
                node.log("Got heartbeat");
                node.log(JSON.stringify(message))
                hostCache.set(message.host,message);
                break;
            case '/presence-scanner/devices':
                node.log("Got device")
                node.log(JSON.stringify(message))
                if (!deviceCache.get(message.payload.smartthing.name)) {
                    present(node,message.payload.smartthing);
                }
                deviceCache.set(message.payload.smartthing.name, message);
                break;
            case '/presence-scanner/state':
                node.log("Restoring state")
                node.log(JSON.stringify(message))
                for (var host of _.keys(message.hosts)) {
                    node.log("Restoring state of host: " + host)
                    hostCache.set(message.hosts[host],host)
                }
                for (var device of _.keys(message.devices)) {
                    node.log("Restoring state of device: " + device)
                    deviceCache.set(message.devices[device],device)
                }
                node.client.unsubscribe('/presence-scanner/state');
                break;
        }
    })
}

module.exports = function (RED) {
    'use strict';

    function STPROCESSOR(config) {
        RED.nodes.createNode(this, config);
        this.broker = config.broker;
        this.brokerConn = RED.nodes.getNode(this.broker);
        var node = this;
        node.status({fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected'});
        if (node.brokerConn) {
            var options = Object.assign({},this.brokerConn.options)
            options.clientId = 'STPresenceProcessor_' + (1+Math.random()*4294967295).toString(16);
            this.client  = mqtt.connect(this.brokerConn.brokerurl, options);
            listen(this)
            node.interval = setInterval(() => {
                saveState(node)
            },1*60*1000)
            node.on("close", () => {
                saveState(node);
                node.status({fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected'});
                node.client.end();
                if (node.interval)
                    clearInterval(node.interval)
            })
        } else {
            node.error(RED._('mqtt.errors.missing-config'));
        }
    }
    RED.nodes.registerType('st-presence-processor', STPROCESSOR);
};