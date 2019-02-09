/*
 * Copyright (c) 2014. Knowledge Media Institute - The Open University
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * NodeRed node with support for interaction with BLEs
 *
 * @author <a href="mailto:carlos.pedrinaci@open.ac.uk">Carlos Pedrinaci</a> (KMi - The Open University)
 * based on the initial node by Charalampos Doukas http://blog.buildinginternetofthings.com/2013/10/12/using-node-red-to-scan-for-ble-devices/
 */

var scanner = require('./lib/scanner.js')

module.exports = function(RED) {
    "use strict";
    
    // The main node definition - most things happen in here
    function STPresenceScan(config) {
        // Create a RED node
        RED.nodes.createNode(this,config);

        // var node = this;
        var node = this;
        this.broker = config.broker;
        this.scanner = new scanner(RED.nodes.getNode(this.broker));
        this.status({fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected'});
        this.log("Setting up scanner node")

        this.scanner.on('device', function(device) {
            node.send(obj);
        });

        this.scanner.on('scanning',() => {
            this.status({fill: 'green', shape: 'dot', text: 'Scanning...'});
        })

        this.scanner.on('stopped',() => {
            this.status({fill: 'red', shape: 'ring', text: 'Stopped'});
        })

    }
    
    // Register the node by name. This must be called before overriding any of the
    // Node functions.
    RED.nodes.registerType("st-presence-scanner",STPresenceScan);

}