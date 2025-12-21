const EventEmitter = require('events');

class AppEmitter extends EventEmitter { }

const appEmitter = new AppEmitter();

// Event names constants
const EVENTS = {
    ORDER_CREATED: 'ORDER_CREATED',
    ORDER_MATCHED: 'ORDER_MATCHED',
    POSTULATION_RECEIVED: 'POSTULATION_RECEIVED',
};

module.exports = {
    appEmitter,
    EVENTS
};
