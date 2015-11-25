#!/usr/bin/env node

var express = require('express),
    http = require('http'),
    jwt = require('jsonwebtoken'),
    winston = require('winston'),
    email = require('./email-service'),
    epiquery = process.evn.EPIQUERY_URL,
    port = process.env.PORT,
    secret = process.env.JWT_SECRET,
    app = express();


winston.setLevels(winston.config.syslog.levels);
var log = new (winston.Logger)(transports: [
  new (winston.transports.Console)(level: 'info', timestamp: true)
]);


// use Hogan for templating
app.set('view engine', 'html');    # use .html extension for templates
app.enable('view cache');
app.enable('trust proxy');
app.engine('html', require('hogan-express'));


// route "/healthy": Get the form
app.get('/healthy', function(req, res) {
  res.status(500);
  res.send();
});


// route "/": Get the form
app.get('/', function(req, res) {
  res.render('app', {target: req.params.target}, function(err,html){
    if (err) {
      log.error('Error rendering view',err));
      res.status(500);
      res.send();
    }
    else {
      res.send(html);
    }
  }
});

// route "/submit": Validate and handle form submission
app.post('/submit', function(req, res) {
  // capture form input
  var target = req.body.target;
  // call epiquery to validate user email
  var options = {
    protocal: 'https',
    method: 'post',
    host: epiquery,
    path: '/epiquery/glg-auth/authenticate.mustache'

  };
  var postData = {
    email: req.body.email,
  };
  var req = http.request( options, function(response) {
    var output_string,
        output,
        res_body = {status:'fail',message:'UNKNOWN_ERROR'};
    response.on('data', function(chunk) {
      output_string += chunk;
    });
    response.on('end', function() {
      try {
        output = JSON.parse(output_string)[0];
      }
      catch (err) {
        log.error('Error parsing submitted form values', err);
      }
      finally {
        if (output != null and typeof output != 'undefined') {
          if (output.error != null && typeof output.error != 'undefined' && output.error != '') {
            // if invalid, send rejection message
            res_body = {status:'fail', message: output.error}
          }
          else if (output.PERSON_ID != null && typeof output.PERSON_ID != 'undefined' && output.PERSON_ID != '')  {
            // send success message
            res_body = {status:'success', message: '', name: output.FIRST_NAME}
            // set roles based on IDs returned, format and send email with jtw token in link
            // for now, the only role we support is CM.  In the future, these will have to put in 
            // an array and then joined.
            // TODO: need to check for and verify existing jwt, if any.  If it's invalid, check reason. If reason begins with
            // "jwt token expired at" then reuse the paylod for new token.  Otherwise generate new token from scratch.
            // TODO: what do we do if there's no target?
            var payload = {
              role: (output.COUNCIL_MEMBER_ID != null && typeof output.COUNCIL_MEMBER_ID != undefined && output.COUNCIL_MEMBER_ID != "") ? "cm" : "",
              id: output.PERSON_ID
            }
            /*
              var token = jwt.sign(payload, secret);
            */
          }
        }
        res.writeHead(200, {"Content-Type": "application/json"});
        res.write(JSON.stringify(res_body));
        res.send();
      }
    });
  }
});

var server = app.listen(port, function () {
  var host = server.address().address;
  var port = server.address().port;
  log.info('glg-jwt-auth listening at http://%s:%s', host, port);
};
