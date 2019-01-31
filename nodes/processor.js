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
    node.brokerConn.publish({
        topic: '/st-presence/state',
        payload: JSON.stringify(state),
        qos:2,
        retain: true
    })
}

function listen(node) {
    node.brokerConn.register(node)
    node.on('close', function () {
        // node.status({fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected'});
        node.log("Disconnected")
        node.brokerConn.unsubscribe(node);
    })
    if (node.brokerConn.connected) {
        // node.status({fill: 'green', shape: 'dot', text: 'node-red:common.status.connected'});
    }
    deviceListener(node);
    heartbeatListener(node);
    deviceCache.on("expired", (key,value) => {
        notPresent(node,value);
    })
    hostCache.on("expired", (key,value) => {
        missingHost(node,value);
    })
}

function missingHost(node,host) {
    node.error(`Haven't heard from host ${host.host}. Host might be down?`)
}

function present(node,device) {
    node.log(device.STDeviceName + " present!")
    var topic = `/SmartThings/presence/${device.STDeviceName}/presence`
    node.brokerConn.publish({
        topic: topic,
        payload: 'present',
        qos:1,
        retain: false
    })
}

function notPresent(node,device) {
    node.log($device.STDeviceName + " NOT present!")
    var topic = `/SmartThings/presence/${device.STDeviceName}/presence`
    node.brokerConn.publish({
        topic: topic,
        payload: 'not_present',
        qos:1,
        retain: false
    })
}

function deviceListener(node) {
    var topic = '/presence-scanner/devices'
    var id = 1;
    node.log("subscribing to " + topic);
    node.brokerConn.subscribe(topic, 0, (topic,payload,packet) => {
        payload = JSON.parse(payload.toString());
        node.log("Got device")
        if (!deviceCache.get(payload.STDeviceName)) {
            present(node,payload);
        }
        deviceCache.set(payload.STDeviceName, payload);
        node.log(JSON.stringify(payload))
    },id)
    node.on('close', done => {
        node.brokerConn.unsubscribe(topic,id);
    })
}

function heartbeatListener(node) {
    var topic = '/presence-scanner/heartbeat'
    node.log("subscribing to " + topic);
    var id = 2;
    node.brokerConn.subscribe(topic, 0, (topic,payload,packet) => {
        payload = JSON.parse(payload.toString());
        node.log("Got heartbeat")
        hostCache.set(payload.host,payload);
        node.log(JSON.stringify(payload))
    },id)
    node.on('close', done => {
        node.brokerConn.unsubscribe(topic,id);
    })
    setInterval(() => {
        saveState(node)
    },1*60*1000)
}

module.exports = function (RED) {
    'use strict';

    function STPROCESSOR(config) {
        RED.nodes.createNode(this, config);
        this.broker = config.broker;
        this.brokerConn = RED.nodes.getNode(this.broker);
        var node = this;
        if (this.brokerConn) {
            listen(this)
            var id = 3;
            this.brokerConn.subscribe('/st-presence/state',2, (topic,payload,packet) => {
                node.log("Restoring state")
                var state = JSON.parse(payload.toString());
                for (var host of _keys(state.hosts)) {
                    node.log("Restoring state of host: " + host)
                    hostCache.set(host,state.hosts[host])
                }
                for (var device of _keys(state.devices)) {
                    node.log("Restoring state of device: " + device)
                    deviceCache.set(device,state.devices[device])
                }
                node.unsubscribe('/st-presence/state',2);
            },id)
        } else {
            this.error(RED._('mqtt.errors.missing-config'));
        }
    }
    RED.nodes.registerType('st-presence-processor', STPROCESSOR);
};