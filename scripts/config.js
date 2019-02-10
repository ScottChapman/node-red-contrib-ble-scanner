var Configure = require(__dirname + '/../lib/config.js')
var config = require('config')

configure = new Configure(config.get("broker"))

configure.on('connect', () => {
    console.log("connected")
    configure.publish(config.get("map"))
});

configure.on('published',() => {
    console.log("published")
    configure.end();
})

configure.on('close',() => {
    console.log("Done")
})
