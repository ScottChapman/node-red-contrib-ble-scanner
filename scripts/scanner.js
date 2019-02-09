var Scanner = require('./lib/scanner.js')
var config = require('config')

scanner = new Scanner(config.get("broker"),config.get("map"))

scanner.on('device', function(device) {
    console.log(JSON.stringify(device))
});

scanner.on('scanning',() => {
    console.log("Scanning...")
})

scanner.on('stopped',() => {
    console.log("stopped...")
})