var nodemailer = require('nodemailer'),
    smtpTransport = require('nodemailer-smtp-transport'),
    hogan = require('hogan.js'),
    fs = require('fs'),
    winston = require('winston');
winston.setLevels(winston.config.syslog.levels);
var log = new (winston.Logger)({transports: [
  new (winston.transports.Console)({level: 'info', timestamp: true})
]});

var transporter = nodemailer.createTransport(
  smtpTransport({port: process.env.SMTP_PORT, host: process.env.SMTP_HOST})
);


module.exports = function(template_name) {
  var template = fs.readFileSync(template_name,'utf-8');
  var compiled = hogan.compile(template);
  return {
    send: function(templateData, emailData) {
      emailData.html = compiled.render(templateData);
      transporter.sendMail(emailData, function(err, result){
        if(err) {
          log.warn('Error Sending Email: ', err);
        }
      });
    }
  }
};
