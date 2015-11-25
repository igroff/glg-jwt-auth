var nodemailer = require('nodemailer'),
    smtpTransport = require('nodemailer-smtp-transport'),
    hogan = require('hogan.js'),
    winston = require('winston');
winston.setLevels(winston.config.syslog.levels);
var log = new (winston.Logger)(transports: [
  new (winston.transports.Console)(level: 'info', timestamp: true)
]);

var transporter = nodemailer.createTransport(
  smtpTransport({port: process.env.SMPT_PORT, host: process.env.SMPT_HOST})
);

var template = fs.readFileSync('./email/login.html','utf-8');
var compiled = hogan.compile(template);

module.exports = {
  send: function(templateData, emailData) {
    emailData.html = compiled.render(templateData);
    transporter.sendMail(emailData, function(err, result){
      if(err) {
        log.warn('Error Sending Email: ', err);
      }
    });
  }
};
