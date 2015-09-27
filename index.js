"use strict";
var Mailgun = require('mailgun').Mailgun,
    MailComposer = require("mailcomposer").MailComposer,
    fs = require('fs'),
    path = require('path'),
    P = require('bluebird');

exports.register = function (plugin, options, next) {
    plugin.log(['plugin', 'info'], "Registering the Mailer plugin");

    var config = plugin.plugins['hapi-config'].CurrentConfiguration;
    var log = plugin.plugins['covistra-system'].systemLog;
    var TemplateEngine = plugin.plugins['covistra-system'].TemplateEngine;

    var mg = new Mailgun(config.get('plugins:mailer:mailgun:key'));

    TemplateEngine.registerTemplate('email_fr', fs.readFileSync(path.resolve(__dirname, "layouts", "mail-fr.html.hbs"), 'utf8'));
    TemplateEngine.registerTemplate('email_en', fs.readFileSync(path.resolve(__dirname, "layouts", "mail-en.html.hbs"), 'utf8'));

    plugin.expose('sendEmailToUser', function (from, user, subject, text) {
        log.debug("Mailer:sendEmailToUser", from, user, subject);
        return new P(function (resolve, reject) {
            mg.sendText(from, [user.email], subject, text, function (err) {
                if (err) {
                    console.dir(err);
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    });

    /**
     * Content maybe the following:
     *
     * {string}: This content will be used directly as the body of the email
     * template: If the template field is provided, this will be used as a templateId and rendered. data will be used to provide context
     * layout: This is a template engine used to provided skining and look and feel. content can be provided and will me merged with the layout
     */
    plugin.expose('sendRichEmailToUser', function (from, user, subject, content) {
        log.debug("Mailer:sendEmailToUser", from, user, subject);
        return new P(function (resolve, reject) {
            var mc = new MailComposer();

            if(content.template) {
                log.debug("Rendering template %s with data", content.template, content.data);
                content.content = TemplateEngine.renderTemplate(content.template, content.data, { sync: true });
            }

            if(content.layout) {
                log.debug("Rendering email with layout %s", content.layout);
                content = TemplateEngine.renderTemplate(content.layout, { content: content.content }, { sync: true });
            }

            mc.setMessageOption({
                from: from,
                to: user.email,
                subject: subject,
                html: content
            });

            return P.promisify(mc.buildMessage, mc)().then(function (msg) {
                log.trace("Message was built", msg);

                if (!options.testMode) {
                    return P.promisify(mg.sendRaw, mg)(from, [user.email], msg).then(resolve).then(function () {
                        log.debug("Message was successfully sent");
                    });
                }
                else {
                    log.debug("Test Mode: Message was will not be sent", from, [user.email]);
                    log.trace("Message content:", msg);
                    resolve();
                }
            }).catch(reject);
        });
    });

    next();
};

exports.register.attributes = {
    pkg: require('./package.json')
};
