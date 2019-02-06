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
const util = require('util');
const mqtt = require('mqtt')
var bluetooth = require('../lib/bluetoothctl.js');
var os = require('os');
const setTimeoutPromise = util.promisify(setTimeout);
const setImmediatePromise = util.promisify(setImmediate);
const startDelay = 20;
const stopDelay = 15;

// Take care of starting the scan and sending the status message
function startScan(node) {
    node.scanner.spawn();
    node.log("Inside startScan")
    if (!node.scanning) {
        // start the scan
        node.log("Scanning for BLEs started.");
        node.scanner.scanOn()
        node.status({fill:"green",shape:"dot",text:"started"});
        node.scanning = true;
    }
}

// Take care of stopping the scan and sending the status message
function stopScan(node) {
    node.log("Inside stopScan")
    if (node.scanning) {
        // stop the scan
        node.scanner.exit();
        node.log('BLE scanning stopped.');
        node.status({fill:"red",shape:"ring",text:"stopped"});
        node.scanning = false;
    }
}

function startScanning(node) {
    node.log("StartScanning")
    scanIteration(node)
    interval = setInterval(() => {
        // send heartbeat
        node.client.publish('/presence-scanner/heartbeat', JSON.stringify({
            host: node.machineId,
            timestamp: new Date().getTime() 
        }),{qos: 1, retain: false})
        if (node.map) {
            node.log("interval")
            scanIteration(node);
        }
    },startDelay * 1000)
}

function getConfig(node) {
    node.log("Get Config")
    var interval;
    node.client.on('connect', function () {
        node.log("connected")
        node.client.subscribe('/presence-scanner/config', (err) => {
            if (err)
                node.error(err);
            else
                node.status({fill: 'green', shape: 'dot', text: 'Scanning'});
        });
    })

    node.client.on('message', (topic,message) => {
        node.log("Updated config")
        node.map = JSON.parse(message);
        console.dir(node.map)
    });

    node.client.on('close', function () {
        node.status({fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected'});
        if (interval)
            clearInterval(interval);
        node.log("Disconnected")
    })
}

function scanIteration(node) {
    node.log("ScanIteration")
    return new Promise((resolve,reject) => {
        node.log("Scan iteration start")
        startScan(node);
        setTimeoutPromise(stopDelay*1000).then(() => {
            node.log("Scan iteration stop")
            stopScan(node)
        })

    })
}

module.exports = function(RED) {
    "use strict";

    
    // The main node definition - most things happen in here
    function STPresenceScan(config) {
        // Create a RED node
        RED.nodes.createNode(this,config);

        // var node = this;
        var node = this;
        this.broker = config.broker;
        this.brokerConn = RED.nodes.getNode(this.broker);
        this.machineId = os.hostname();
        this.scanning = false;
        this.status({fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected'});
        var options = Object.assign({},this.brokerConn.options)
        options.clientId = 'STPresenceScan_' + (1+Math.random()*4294967295).toString(16);
        this.client  = mqtt.connect(this.brokerConn.brokerurl, options);
        this.log("Setting up scanner node")
        node.scanner = new bluetooth();

        // get config
        getConfig(node);

        this.scanner.on('device', function(device) {
            node.log("Found device: " + JSON.stringify(device))
            if (node.map && node.map.hasOwnProperty(device.uuid)) {
                node.log("Found device I was looking for...")
                // Generate output event
                var obj = {
                    host: node.machineId,
                    timestamp: new Date().getTime(),
                    payload: {
                        bluetooth: device,
                        smartthing: {
                            name: node.map[device.uuid]
                        }
                    }

                }
                node.client.publish('/presence-scanner/devices',JSON.stringify(obj), {qos: 1, retain: false})
                node.send(obj);
            }
        });

        startScanning(node);

        this.on("close", function() {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: this.client.disconnect();
            stopScan(node);
            node.client.end();
            // remove listeners since they get added again on deploy
            node.scanner.removeAllListeners();
        });

    }
    
    // Register the node by name. This must be called before overriding any of the
    // Node functions.
    RED.nodes.registerType("st-presence-scanner",STPresenceScan);

}

/*

var config = {
    duplicates: false
}

var mock = {
    on: function (name, func) {
        console.log("on: " + name)
    },
    nodes: {
        registerType: function (name, func) {
            console.log("Registered: " + name)
            func(config);
        },
        createNode: function(obj,n) {
            console.log("createNode")
        }
    },
    send: function(msg) {
        console.log("send: " + msg)
    },
    status: function(obj) {
        console.log("status: " + JSON.stringify(obj))
    },
    log: function(msg) {
        console.log("log: " + msg)
    }
}



module.exports(mock)
*/