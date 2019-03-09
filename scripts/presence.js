var Processor = require(__dirname + '/../lib/processor.js')
var config = require('config')
const logger = require(__dirname + '/../lib/logger.js').getLogger("presence")

proc = new Processor(config.get("broker"))

proc.on('connected', () => {
    logger.info("connected")
});

proc.on('disconnected', () => {
    logger.info("disconnected")
});

proc.on("present", (device) => {
    logger.info("Device PRESENT: " + JSON.stringify(device))
})

proc.on("not_present", (device) => {
    logger.info("Device NOT PRESENT: " + JSON.stringify(device))
})

proc.on("device", (device) => {
    logger.debug("Device found")
    logger.debug(device)
})

proc.on("heartbeat",(host) => {
    logger.debug("heartbeat found")
    logger.debug(host)
})

proc.on("state_saved",() => {
    logger.info("State Saved")
})

proc.on("state_restored",() => {
    logger.info("State Restored")
})
