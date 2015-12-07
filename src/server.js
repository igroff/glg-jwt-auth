#!/usr/bin/env node

var express = require('express'),
    request = require('request'),
    bodyParser = require('body-parser'),
    url = require('url'),
    jwt = require('jsonwebtoken'),
    winston = require('winston'),
    templates = process.cwd() + '/templates',
    email = require('./email-service')(templates + '/login_email.html'),
    local_epi = process.env.LOCAL_EPIQUERY,
    port = process.env.PORT,
    secret = process.env.JWT_SECRET,
    app = express();


winston.setLevels(winston.config.syslog.levels);
var log = new (winston.Logger)({transports: [
  new (winston.transports.Console)({level: 'info', timestamp: true})
]});



app.use(bodyParser.urlencoded({extended:true}));
// use Hogan for templating
app.set('view engine', 'html');    // use .html extension for templates
app.set('views', templates);
//app.enable('view cache');
app.enable('trust proxy');
app.engine('html', require('hogan-express'));


// route "/healthy"
app.get('/healthy', function(req, res) {
  res.status(200);
  res.send();
});

// route static stuff
app.use('/bower_components', express.static('bower_components'));
app.use('/css', express.static('css'));
app.use('/fonts', express.static('fonts'));
app.use('/favicon.ico', express.static('favicon.ico'));

// route "/": Get the form
app.get('/', function(req, res) {
  res.render('login_form', {target: req.params.target, jwt: req.params.jwt}, function(err,html){
    if (err) {
      log.error('Error rendering view',err);
      res.status(500);
      res.send();
    }
    else {
      res.send(html);
    }
  })
});

// route "/submit": Validate and handle form submission
app.post('/submit', function(req, res) {
  // capture form input
  var target = req.body.target;
  var orig_jwt = req.body.jwt;
  var epiUrl = local_epi + 'epiquery1/glglive/glg-auth/authenticate.mustache'

  // call epiquery to validate user email
  request.post(epiUrl,
    {form: {email: req.body.email}},
    function (err, httpResponse, body) {
      output = {};
      if (err) {
        log.error('Error posting to epiquery', err);
        output.error = 'Unable to post epiquery request';
        completeAuth(target, output, res, false);
        return;
      };
      try {
        output = JSON.parse(body)[0];
      }
      catch (err) {
        log.error('Error parsing submitted form values', err);
        output.error = 'Unable to parse epiquery response';
        completeAuth(target, output, res, false);
        return;
      }
      if (output.error != null && typeof output.error != 'undefined' && output.error != '') {
        // if invalid, send rejection message
        completeAuth(target, output, res, false);
        return;
      }
      if (output.PERSON_ID == null || typeof output.PERSON_ID == 'undefined' || output.PERSON_ID == '') {
        // none of the things we expect to be in the epiquery response are there
        output.error = 'UNKNOWN ERROR';
        completeAuth(target, output, res, false);
        return;
      }
      // set roles based on IDs returned, For now, the only role we support is CM.
      var payload = {
        role: (output.COUNCIL_MEMBER_ID != null && typeof output.COUNCIL_MEMBER_ID != undefined && output.COUNCIL_MEMBER_ID != "") ? "cm" : "",
        id: output.PERSON_ID
      }
      if (orig_jwt != "") {
        // If the token is valid or expired then augment the paylod with info from the old token.
        jwt.verify(orig_jwt, secret, function(err, decoded) {
          if (err == null || typeof error == 'undefined' || err.name == 'TokenExpiredError') {
            for (key in Object.keys(decoded.payload)) {
              if (key != 'role' && key != 'id' && key != 'exp') {
                payload[key] = decoded.payload[key];
              }
            }
          }
          signAndComplete(target, output, res, payload);
        });
      }
      else {
        signAndComplete(target, output, res, payload);
      }
    }
  );
});

var signAndComplete = function(target, output, res, payload) {
  var target = target;
  jwt.sign(payload, secret, {algorithm: "HS256", expiresIn: "1h"}, function(new_jwt) {
    var emailData = {
      from: 'membersolutions@glgroup.com',
      to: output.EMAIL,
      subject: 'GLG Login'
    };
    // TODO: For testing, we're going to hardcode our own emails.  Before deployment, delete the following line:
    emailData.to = "asegal@glgroup.com,squince@glgroup.com";
    // TODO: what do we do if there's no target? For now, default to glg.it
    var email_target = 'https://glg.it';
    log.info("target = " + target);
    if (target != null && typeof target != 'undefined' && target != '') {
      target_url = url.parse(target, true);
      target_url.query.jwt = new_jwt;
      email_target = url.format(target_url);
    }
    var templateData = {
      jwt: new_jwt,
      target: email_target,
      first_name: output.FIRST_NAME,
      last_name: output.LAST_NAME
    };
    // TODO: delete line below and uncomment email.send
    email.log(templateData, emailData);
    // email.send(templateData, emailData);

    completeAuth(target, output, res, true);
  });
};

var completeAuth = function(target, output, res, isAuthenticated) {
  res_body = {status: isAuthenticated ? 'success' : 'error', message: output.error ? output.error : '', name: output.FIRST_NAME}
  res.writeHead(200, {"Content-Type": "application/json"});
  res.write(JSON.stringify(res_body));
  res.send();
};

var server = app.listen(port, function () {
  var host = server.address().address;
  var port = server.address().port;
  log.info('glg-jwt-auth listening at http://%s:%s', host, port);
});
