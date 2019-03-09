const _ = require('lodash')
const os = require('os')
require('winston-syslog').Syslog;
const { loggers, format, transports } = require('winston');
const { combine, colorize, simple,timestamp, printf } = format;
const config = require('config').get("syslog")

var consoleFormat = combine(
    colorize(),
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

var syslogFormat = printf(({ level, message, label, timestamp }) => {
    return message;
})

module.exports.getLogger = function (name) {
    var level = config.get("levels.default")
    if (config.levels.hasOwnProperty(name))
        level = config.levels[name]

    if (!loggers.has(name)) {
        loggers.add(name, {
            transports: [
                new transports.Console({
                    level: level,
                    format: consoleFormat,
                }),
                new transports.Syslog({
                    level: "info",
                    host: config.host,
                    app_name: name,
                    format: syslogFormat,
                    localhost: os.hostname
                })
            ]
        })
    }
    return loggers.get(name)
}
  