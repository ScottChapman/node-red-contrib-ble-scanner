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

const mqtt = require('mqtt')
const validator = require('validator')
const _ = require('lodash')

function publish(node, payload) {
    var options = Object.assign({},node.brokerConn.options)
    options.clientId = "mqtt_st_precence"
    var client  = mqtt.connect(node.brokerConn.brokerurl, {clientId: "MyUniqClient"});
    client.on('connect', function () {
        node.log("connected")
        node.status({fill: 'green', shape: 'dot', text: 'node-red:common.status.connected'});
        client.publish('/presence-scanner/config', fixMap(payload), { qos: 1, retain: true }, (err) => {
            node.log("SENT")
            client.end();
        })
    })
    client.on('close', function () {
        node.status({fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected'});
        node.log("Disconnected")
    })
}

function fixMap(map) {
    console.dir(map)
    if (typeof map === "string")
        map = JSON.parse(map)
    var result = {};
    for (var id of _.keys(map)) {
        var newID = id.toLowerCase().replace(/:/g,"");
        console.log("Was: " + id + " converted to: " + newID)
        result[newID] = map[id];
    }
    console.dir(result)
    return result;
}

module.exports = function (RED) {
    'use strict';

    function STCONFIG(config) {
        RED.nodes.createNode(this, config);
        this.broker = config.broker;
        this.brokerConn = RED.nodes.getNode(this.broker);
        if (this.brokerConn) {
            this.log("publishing config from node")
            publish(this,config.map)
        } else {
            this.error(RED._('mqtt.errors.missing-config'));
        }
        this.on('input', function(message) {
            this.log("publishing from input")
            publish(this,message.payload)
        });
    }
    RED.nodes.registerType('st-presence-config', STCONFIG);
};