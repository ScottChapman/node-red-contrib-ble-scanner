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

function publish(connection, payload) {
    console.log("sending...")
    var msg = {
        qos: 1,
        retain: true,
        topic: '/presence-scanner/config'
    }
    msg.payload = payload;
    connection.publish(msg , (err) => {
        console.log("SENT")
        console.dir(err)
    })
}

module.exports = function (RED) {
    'use strict';

    function STCONFIG(config) {
        RED.nodes.createNode(this, config);
        this.broker = config.broker;
        this.brokerConn = RED.nodes.getNode(this.broker);
        const node = this;
        if (this.brokerConn) {
            this.status({fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected'});
            console.log("registered")
            if (this.brokerConn.connected) {
                console.log("CONNECTED")
                node.status({fill: 'green', shape: 'dot', text: 'node-red:common.status.connected'});
                publish(this.brokerConn,config.map)
                node.on('input', function(message) {
                    publish(this.brokerConn,msg.payload)
                });
            }
            else {
                console.log("Not connected...")
            }
            this.brokerConn.register(this);
            this.on('close', done => {
                if (node.brokerConn) {
                    node.brokerConn.deregister(node, done);
                }
            });
        } else {
            this.error(RED._('mqtt.errors.missing-config'));
        }
    }
    RED.nodes.registerType('st-presence-config', STCONFIG);
};