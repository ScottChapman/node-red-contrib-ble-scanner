var Status = require(__dirname + '/../lib/status.js')
var config = require('config')

status = new Status(config.get("broker"))