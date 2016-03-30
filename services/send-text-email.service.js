var P = require('bluebird'),
    mg = require('mailgun'),
    Joi = require('joi');

module.exports = function(server, config, log) {

    var service = function(msg) {
        log.debug("Mailer:sendEmailToUser", msg.from, msg.recipients, msg.subject);
        return P.promisify(mg.sendText, { context: mg})(msg.from, msg.recipients, msg.subject, msg.text);
    };

    return {
        pattern: {role:'mailer', target: 'email', action: 'send'},
        schema: Joi.object().keys({
            from: Joi.string(),
            recipients: Joi.array().items(Joi.string().email()),
            subject: Joi.string(),
            text: Joi.string().required()
        }),
        callback: service
    }
};
