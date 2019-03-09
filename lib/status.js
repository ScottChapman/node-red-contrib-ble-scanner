const _ = require('lodash')
const mqtt = require('mqtt')

module.exports = class Status {
    constructor(connect) {
        this.connect = connect;
        connect.options.clientId = 'STPresenceProcessor_' + (1+Math.random()*4294967295).toString(16);
        this.client  = mqtt.connect(this.connect.brokerUrl, this.connect.options);
        this.client.subscribe([
            '/presence-scanner/config',
            '/presence-scanner/state'
        ],(err,granted) => {
            console.log("listening...")
        })
        this.client.on("message", (topic,message) => {
            message = JSON.parse(message);
            switch (topic) {
                case '/presence-scanner/state':
                    this.client.unsubscribe('/presence-scanner/state');
                    console.log("State found:");
                    console.log("***\n"+JSON.stringify(message,null,2)+"\n***")
                    console.log(JSON.stringify(message,null,2))
                    break;
                case '/presence-scanner/config':
                    this.client.unsubscribe('/presence-scanner/config');
                    console.log("Got Config")
                    console.log("===\n"+JSON.stringify(message,null,2)+"\n===")
                    const list = _.map(_.values(message), device => {
                        return `/smartthings/${device}/presence`
                    })
                    console.dir(list)
                    this.client.subscribe(list,(err,granted) => {
                        console.log("Looking for device state")
                    })
                    break;
                default: 
                    if (topic.match(/smartthings/)) {
                        console.log("Got device state")
                        console.log("+++\n"+JSON.stringify(message,null,2)+"\n+++")
                        this.client.unsubscribe(topic)
                    }
            }
        })
    }

    end() {
        this.client.end();
    }

}