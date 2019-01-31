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
const deviceCache = new NodeCache( { stdTTL: 10*60, checkperiod: 60 } );
const hostCache = new NodeCache( { stdTTL: 30*60, checkperiod: 60 } );

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
}

function deviceListener(node) {
    var topic = '/presence-scanner/devices'
    var id = 1;
    node.log("subscribing to " + topic);
    node.brokerConn.subscribe(topic, 0, (topic,payload,packet) => {
        payload = JSON.parse(payload.toString());
        node.log("Got device")
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
        node.log(JSON.stringify(payload))
    },id)
    node.on('close', done => {
        node.brokerConn.unsubscribe(topic,id);
    })
}

module.exports = function (RED) {
    'use strict';

    function STPROCESSOR(config) {
        RED.nodes.createNode(this, config);
        this.broker = config.broker;
        this.brokerConn = RED.nodes.getNode(this.broker);
        if (this.brokerConn) {
            listen(this)
        } else {
            this.error(RED._('mqtt.errors.missing-config'));
        }
    }
    RED.nodes.registerType('st-presence-processor', STPROCESSOR);
};