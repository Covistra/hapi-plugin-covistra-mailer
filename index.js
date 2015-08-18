/**

 Copyright 2015 Covistra Technologies Inc.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */
"use strict";
var Mailgun = require('mailgun').Mailgun,
    MailComposer = require("mailcomposer").MailComposer,
    _ = require('lodash'),
    P = require('bluebird');

exports.register = function (plugin, options, next) {
    plugin.log(['plugin', 'info'], "Registering the Mailer plugin");

    var config = plugin.plugins['hapi-config'].CurrentConfiguration;
    var log = plugin.plugins['covistra-system'].systemLog;
    var TemplateEngine = plugin.plugins['covistra-system'].TemplateEngine;

    var mg = new Mailgun(config.get('plugins:mailer:mailgun:key'));

    plugin.expose('sendEmailToUser', function(from, user, subject, text) {
        log.debug("Mailer:sendEmailToUser", from, user, subject);
        return new P(function(resolve, reject) {
            mg.sendText(from, [user.email], subject, text, function(err) {
                if(err) {
                    console.dir(err);
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    });

    plugin.expose('sendRichEmailToUser', function(from, user, msg) {
        log.debug("Mailer:sendRichEmailToUser", from, user.email, msg.subject);
        return new P(function(resolve, reject) {
            var mc = new MailComposer();

            if(msg.template) {
                msg.content = TemplateEngine.renderTemplate(msg.template, _.merge(msg.data,{ user: user, from: from}),{ sync: true });
            }

            mc.setMessageOption({
                from: from,
                to: user.email,
                subject: msg.subject,
                html: msg.content
            });

            return P.promisify(mc.buildMessage, mc)().then(function(msg) {
                log.trace("Message was built", msg);

                if(!options.testMode) {
                    return P.promisify(mg.sendRaw, mg)(from, [user.email], msg).then(resolve).then(function() {
                        log.debug("Message was successfully sent");
                    });
                }
                else {
                    log.debug("Test Mode: Message was will not be sent",from, [user.email]);
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
