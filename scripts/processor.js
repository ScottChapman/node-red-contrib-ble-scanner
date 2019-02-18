var Processor = require(__dirname + '/../lib/processor.js')
var config = require('config')

proc = new Processor(config.get("broker"))

proc.on('connected', () => {
    console.log("connected")
});

proc.on('disconnected', () => {
    console.log("disconnected")
});

proc.on("present", (device) => {
    console.log("Device PRESENT")
    console.dir(device)
})

proc.on("not_present", (device) => {
    console.log("Device not present")
    console.dir(device)
})

proc.on("device", (device) => {
    // console.log("Device found")
    // console.dir(device)
})

proc.on("heartbeat",(host) => {
    // console.log("heartbeat found")
    // console.dir(host)
})

proc.on("state_saved",() => {
    // console.log("State Saved")
})

proc.on("state_restored",() => {
    // console.log("State Restored")
})
