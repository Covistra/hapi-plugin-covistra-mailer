var Joi = require('joi'),
    P = require('bluebird'),
    Mailgun = require('mailgun').Mailgun,
    mailComposer = require("mailcomposer");

module.exports = function(server, config, log) {

    var TemplateEngine = server.plugins['covistra-system'].TemplateEngine;

    var MAILGUN_API = config.get("plugins:mailer:mailgun:key");
    var mg = new Mailgun(MAILGUN_API);

    var service = function(msg) {
        log.debug("Mailer:sendEmailToUser", msg.from, msg.recipients, msg.subject);
        return new P(function (resolve, reject) {
            var attachments = [];

            if(msg.content.template) {
                log.debug("Rendering template %s with data", msg.content.template, msg.content.data);

                var tmpl = TemplateEngine.getTemplate(msg.content.template);
                if(tmpl) {

                    if(tmpl.extra.attachments) {
                        attachments = attachments.concat(tmpl.extra.attachments);
                    }

                    msg.content.content = TemplateEngine.renderTemplate(msg.content.template, msg.content.data, { sync: true });
                }

            }

            if(msg.content.layout) {
                log.debug("Rendering email with layout %s", msg.content.layout);

                tmpl = TemplateEngine.getTemplate(msg.content.layout);
                if(tmpl) {

                    if(tmpl.extra.attachments) {
                        attachments = attachments.concat(tmpl.extra.attachments);
                    }

                    msg.content = TemplateEngine.renderTemplate(msg.content.layout, { data: msg.content.data, content: msg.content.content}, { sync: true });
                }

            }

            if(msg.content.attachments) {
                attachments = attachments.concat(msg.content.attachments);
            }

            var options = {
                from: msg.from,
                to: msg.recipients,
                subject: msg.subject,
                html: msg.content,
                attachments: attachments,
                alternatives: []
            };

            if(msg.content.text) {
                options.alternatives.push({
                    contentType: 'text/plain',
                    content: msg.content.text
                });
            }

            var email = mailComposer(options);

            return P.promisify(email.build, {context:email})().then(function (emailMessage) {
                log.trace("Message was built", emailMessage);
                return P.promisify(mg.sendRaw, {context: mg})(msg.from, msg.recipients, emailMessage).then(resolve).then(function () {
                    log.debug("Message was successfully sent");
                });

            }).catch(reject);
        });
    };

    return {
        pattern: {role:'mailer', target: 'email', action: 'send-rich'},
        schema: Joi.object().keys({
            from: Joi.string(),
            recipients: Joi.array().items(Joi.string().email()),
            subject: Joi.string(),
            content: Joi.alternatives().try(Joi.string(), Joi.object().keys({
                data: Joi.object(),
                template: Joi.string().optional(),
                layout: Joi.string().optional(),
                attachments: Joi.array().items(Joi.object()).optional().description('See mailcomposer for details about attachments'),
                text: Joi.string().description("Alternative version if rich email isn't supported").optional()
            }))
        }),
        callback: service
    }
};
