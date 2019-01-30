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
const setTimeoutPromise = util.promisify(setTimeout);
const setImmediatePromise = util.promisify(setImmediate);
const startDelay = 30;
const stopDelay = 25;

// Take care of starting the scan and sending the status message
function startScan(node,noble) {
    node.log("Inside startScan")
    if (!node.scanning) {
        // start the scan
        noble.startScanning([], false, function() {
            node.log("Scanning for BLEs started.");
            node.status({fill:"green",shape:"dot",text:"started"});
            node.scanning = true;
        });
    }
}

// Take care of stopping the scan and sending the status message
function stopScan(node,noble, error) {
    node.log("Inside stopScan")
    if (node.scanning) {
        // stop the scan
        noble.stopScanning(function() {
            node.log('BLE scanning stopped.');
            node.status({fill:"red",shape:"ring",text:"stopped"});
            node.scanning = false;
        });
        if (error) {
            node.warn('BLE scanning stopped due to change in adapter state.');
        }
    }
}

function startScanning(node,noble) {
    node.log("StartScanning")
    scanIteration(node,noble)
    interval = setInterval(() => {
        // send heartbeat
        node.client.publish('/presence-scanner/heartbeat', JSON.stringify({
            host: node.machineId,
            timestamp: new Date().getTime() 
        }),{qos: 1, retain: false})
        if (node.map) {
            node.log("interval")
            scanIteration(node,noble);
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
                node.status({fill: 'green', shape: 'dot', text: 'node-red:common.status.connected'});
        });
    })

    node.client.on('message', (topic,message) => {
        node.log("Updated config")
        node.map = message;
    });

    node.client.on('close', function () {
        node.status({fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected'});
        if (interval)
            clearInterval(interval);
        node.log("Disconnected")
    })
}

function scanIteration(node,noble) {
    node.log("ScanIteration")
    return new Promise((resolve,reject) => {
        node.log("Scan iteration start")
        startScan(node,noble);
        setTimeoutPromise(stopDelay*1000).then(() => {
            node.log("Scan iteration stop")
            stopScan(node,noble)
        })

    })
}

module.exports = function(RED) {
    "use strict";

    var noble = require('noble');
    var os = require('os');
    
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

        // get config
        getConfig(node);

        noble.on('discover', function(peripheral) {
            if (node.map && node.map.hasOwnProperty(peripheral.uuid)) {
                var msg = { payload:{peripheralUuid:peripheral.uuid, localName: peripheral.advertisement.localName} };
                node.log("Found uuid: " + peripheral.uuid)
                msg.STDeviceName = node.map[peripheral.uuid]
                msg.peripheralUuid = peripheral.uuid;
                msg.localName = peripheral.advertisement.localName;
                msg.detectedAt = new Date().getTime();
                msg.detectedBy = node.machineId;
                msg.advertisement = peripheral.advertisement;
                msg.rssi = peripheral.rssi;
    
                // Check the BLE follows iBeacon spec
                if (peripheral.manufacturerData) {
                    // http://www.theregister.co.uk/2013/11/29/feature_diy_apple_ibeacons/
                    if (peripheral.manufacturerData.length >= 25) {
                        var proxUuid = peripheral.manufacturerData.slice(4, 20).toString('hex');
                        var major = peripheral.manufacturerData.readUInt16BE(20);
                        var minor = peripheral.manufacturerData.readUInt16BE(22);
                        var measuredPower = peripheral.manufacturerData.readInt8(24);
    
                        var accuracy = Math.pow(12.0, 1.5 * ((rssi / measuredPower) - 1));
                        var proximity = null;
    
                        if (accuracy < 0) {
                            proximity = 'unknown';
                        } else if (accuracy < 0.5) {
                            proximity = 'immediate';
                        } else if (accuracy < 4.0) {
                            proximity = 'near';
                        } else {
                            proximity = 'far';
                        }
    
                        msg.manufacturerUuid = proxUuid;
                        msg.major = major;
                        msg.minor = minor;
                        msg.measuredPower = measuredPower;
                        msg.accuracy = accuracy;
                        msg.proximity = proximity;
                    }
                }
    
                // Generate output event
                node.client.publish('/presence-scanner/devices',message, {qos: 1, retain: false})
                node.send(msg);
            }
        });


        // deal with state changes
        noble.on('stateChange', function(state) {
            node.log("State changed on BTLE controller")
            if (state === 'poweredOn') {
                startScanning(node, noble);
            } else {
                if (node.scanning) {
                    stopScan(node,noble, true);
                }
            }
        });

        this.on("close", function() {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            // eg: this.client.disconnect();
            stopScan(node,noble, false);
            // remove listeners since they get added again on deploy
            noble.removeAllListeners();
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