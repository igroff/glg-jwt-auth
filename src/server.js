#!/usr/bin/env node

var express = require('express),
    http = require('http'),
    epiquery = process.evn.EPIQUERY_URL,
    port = process.env.PORT,
    jwt = require('jsonwebtoken'),
    secret = process.env.JWT_SECRET,
    winston = require('winston');
    app = express();


winston.setLevels winston.config.syslog.levels
log = new (winston.Logger)(transports: [
  new (winston.transports.Console)(level: 'info', timestamp: true)
])


// use Hogan for templating
app.set('view engine', 'html');    # use .html extension for templates
app.enable('view cache');
app.enable('trust proxy');
app.engine('html', require('hogan-express'));

// route "/": Get the form
app.get('/', function(req, res) {
  res.render('app', {target: req.params.target}, function(err,html){
    if (err) {
      log.error(err));
      res.status(500);
      res.send();
    }
    else {
      res.send(html);
    }
  });
}

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
        res_body = {status:'error',message:''};
    response.on('data', function(chunk) {
      output_string += chunk;
    });
    response.on('end', function() {
      try {
        output = JSON.parse(output_string);
      }
      catch (err) {
        log.error(err);
      }
      finally {
        if (output != null and typeof output != 'undefined') {
          // if invalid, send rejection message
          // otherwise, set roles based on IDs returned, format and send email with jtw token in link
          // send success message
        }
        res.writeHead(200, {"Content-Type": "application/json"});
        res.write(JSON.stringify(res_body));
        res.send();
      }
    });
  });
}

var server = app.listen(port, function () {
  var host = server.address().address;
  var port = server.address().port;
  log.info('glg-jwt-auth listening at http://%s:%s', host, port);
};


  var payload = {id: 'testuser', role: 'tester'};
  var token = jwt.sign(payload, secret);
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write(token);
  res.end();
