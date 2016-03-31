#!/usr/bin/env node

var express = require('express'),
    request = require('request'),
    bodyParser = require('body-parser'),
    url = require('url'),
    jwt = require('jsonwebtoken'),
    winston = require('winston'),
    templates = process.cwd() + '/templates',
    email = require('./email-service')(templates + '/login_email.html'),
    port = process.env.PORT || 3000,
    secret = process.env.JWT_SECRET || 'SecretsAreBad',
    defaultRedirect = process.env.DEFAULT_REDIRECT,
    app = express();


winston.setLevels(winston.config.syslog.levels);
var log = new (winston.Logger)({transports: [
  new (winston.transports.Console)({level: 'debug', timestamp: true})
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
  res.render('login_form', {redirectTo: req.query.redirectTo || defaultRedirect, jwt: req.query.jwt}, function(err,html){
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
  console.log("submit");
  // capture form input
  var orig_jwt = req.body.jwt;
  var redirectTo = req.body.redirectTo;
  console.log("redirectTo: " + redirectTo);

  var payload = { role: req.query || "user" };
  if (orig_jwt != "") {
    // If the token is valid or expired then augment the paylod with info from the old token.
    jwt.verify(orig_jwt, secret, function(err, decoded) {
      for (key in Object.keys(decoded.payload)) {
        if (key != 'role') {
          payload[key] = decoded.payload[key];
        }
      }
      signAndComplete(redirectTo, res, payload);
    });
  }
  else {
    signAndComplete(redirectTo, res, payload);
  }
});

var signAndComplete = function(redirectTo, res, payload) {
  console.log("signAndComplete");
  var redirectTo = redirectTo;
  jwt.sign(payload, secret, {algorithm: "HS256", expiresIn: "1h"}, function(new_jwt) {
    completeAuth(redirectTo, res, true, new_jwt);
  });
};

var completeAuth = function(redirectTo, res, isAuthenticated, jwt) {
  console.log("completeAuth");
  res_body = {status: isAuthenticated ? 'success' : 'error', jwt: jwt, redirectTo: redirectTo}
  res.writeHead(200, {"Content-Type": "application/json"});
  res.write(JSON.stringify(res_body));
  res.send();
};

var server = app.listen(port, function () {
  var host = server.address().address;
  var port = server.address().port;
  log.info('glg-jwt-auth listening at http://%s:%s', host, port);
});
