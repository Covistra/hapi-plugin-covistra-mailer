"use strict";
var fs = require('fs'),
    path = require('path');

exports.deps = ['covistra-system'];

exports.register = function (plugin, options, next) {
    plugin.log(['plugin', 'info'], "Registering the Mailer plugin");

    var config = plugin.plugins['hapi-config'].CurrentConfiguration;
    var TemplateEngine = plugin.plugins['covistra-system'].TemplateEngine;
    var Services = plugin.plugins['covistra-system'].Services;

    // Register default email template
    TemplateEngine.registerTemplate('email', fs.readFileSync(path.resolve(__dirname, "layouts", "email.html.hbs"), 'utf8'));

    Services.discover(__dirname, "services");

    next();
};

exports.register.attributes = {
    pkg: require('./package.json')
};
