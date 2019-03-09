const _ = require('lodash')
const os = require('os')
require('winston-syslog').Syslog;
const { loggers, format, transports } = require('winston');
const { combine, colorize, simple,timestamp, printf } = format;

var consoleFormat = combine(
    // colorize(),
    timestamp({format:"YYYY-MM-DD hh:mm:ss.SSS A"}),
    printf(({ level, message, label, timestamp }) => {
        return `${timestamp} ${level}: ${message}`;
    })
)

var fileFormat = combine(
    timestamp({format:"YYYY-MM-DD hh:mm:ss.SSS A"}),
    printf(({ level, message, label, timestamp }) => {
        return `${timestamp} ${level} [${label}]: ${message}`;
        })
)

module.exports.getLogger = function (name) {
    if (!loggers.has(name)) {
        loggers.add(name, {
            transports: [
                new transports.Console({
                    level: 'info',
                    format: consoleFormat,
                }),
                new transports.Syslog({
                    level: "info",
                    host: "192.168.1.53",
                    app_name: name,
                    format: simple(),
                    localhost: os.hostname
                })
            ]
        })
    }
    return loggers.get(name)
}
  