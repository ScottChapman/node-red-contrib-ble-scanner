const { spawn } = require('child_process');
const ransi = require('strip-ansi')
const split = require('split-lines')
const EventEmitter = require('events')

module.exports = class BluetoothCtl extends EventEmitter {
    constructor() {
        super();
        this.bluetoothctl = spawn('bluetoothctl');
        this.bluetoothctl.stdout.on('data', (data) => {
            data = ransi(data.toString('utf-8'));
            for (var line of split(data)) {
                const regex = /\[NEW\] Device ([0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2})\s+(.+)$/gm;
                let m;
                
                while ((m = regex.exec(line)) !== null) {
                    // This is necessary to avoid infinite loops with zero-width matches
                    if (m.index === regex.lastIndex) {
                        regex.lastIndex++;
                    }
                    
                    this.emit('device', {
                        id: m[1],
                        name: m[2]
                    })
                }
            }
        });
    };

    scanOn() {
        this.bluetoothctl.stdin.write("scan on\n")
    }

    scanOff() {
        this.bluetoothctl.stdin.write("scan off\n")
    }

    exit() {
        this.bluetoothctl.kill();
    }

}
