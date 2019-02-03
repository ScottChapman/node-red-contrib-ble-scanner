const { spawn } = require('child_process');
const ransi = require('strip-ansi')
const split = require('split-lines')
const EventEmitter = require('events')

module.exports = class BluetoothCtl extends EventEmitter {
    constructor() {
        this.bluetoothctl = spawn('bluetoothctl');
        bluetoothctl.stdout.on('data', (data) => {
            data = ransi(data.toString('utf-8'));
            for (var line of split(data)) {
                console.dir(line);
                const regex = /\[NEW\] Device ([0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2})\s+(.+)$/gm;
                let m;
                
                while ((m = regex.exec(line)) !== null) {
                    // This is necessary to avoid infinite loops with zero-width matches
                    if (m.index === regex.lastIndex) {
                        regex.lastIndex++;
                    }
                    
                    console.dir(m);

                    this.emit('device', {
                        id: m[1],
                        name: m[2]
                    })
                }
            }
        });
    };

    scanOn() {
        bluetoothctl.stdin.write("scan on\n")
    }

    scanOff() {
        bluetoothctl.stdin.write("scan off\n")
    }

}
