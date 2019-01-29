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

var mqtt = require('mqtt')

function publish(connection, payload) {
    console.log("sending...")
    var client  = mqtt.connect(this.brokerConn.brokerurl ,this.brokerConn.options);
    client.on('connect', function () {
        this.status({fill: 'green', shape: 'dot', text: 'node-red:common.status.connected'});
        console.log("CONNECTED")
        client.publish('/presence-scanner/config', payload, { qos: 1, retain: true }, (err) => {
            console.log("SENT")
            console.dir(err)
            client.end();
        })
    })
    client.on('close', function () {
        this.status({fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected'});
        console.log("Disconnected")
    })
}

module.exports = function (RED) {
    'use strict';

    function STCONFIG(config) {
        RED.nodes.createNode(this, config);
        this.broker = config.broker;
        this.brokerConn = RED.nodes.getNode(this.broker);
        if (this.brokerConn) {
            publish(this.brokerConn,config.map)
        } else {
            this.error(RED._('mqtt.errors.missing-config'));
        }
        this.on('input', function(message) {
            publish(this.brokerConn,msg.payload)
        });
    }
    RED.nodes.registerType('st-presence-config', STCONFIG);
};