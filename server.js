var express = require('express');
var app = express();
var needle = require("needle");


var User = function(email) {
  this.email= email;
};

var users = [];

app.get('/', function (req, res) {
  res.sendfile(__dirname + "/index.html");
});

app.get('/index.html', function (req, res) {
  res.sendfile(__dirname + "/index.html");
});

app.get('/main.css', function (req, res) {
  res.sendfile(__dirname + "/main.css");
});

app.get('/rocket.jpg', function(req, res) {
  res.sendfile(__dirname + "/rocket.jpg");
});

app.get('/favicon.ico', function(req, res) {
  res.sendfile(__dirname + "/favicon.ico");
});

function subscribe(email, firstName, lastName) {
  
  var body = {};
  body.email_address = email;
  body.status = "subscribed";
  
  var userInfo = {};
  userInfo.FNAME = firstName;
  userInfo.LNAME = lastName;
  
  body.merge_fields = userInfo;
  body = JSON.stringify(body);
  
  needle.post('https://us15.api.mailchimp.com/3.0/lists/648a0bcc0c/members/', body, {headers: {"Authorization": "apikey 9a4fb48300cb26ac875f313284452a35-us15"}}, function(err, resp, bod) {
  });
}

app.get('/register', function (req, res) {
  if (req.query.e && req.query.fn && req.query.ln) {
    users.push(new User(req.query.e));
    console.log(req.query.e + " has registered!");
    subscribe(req.query.e, req.query.fn, req.query.ln);
  }
  res.redirect('../');
});

app.get('/prospectus', function(req, res) {
  res.sendfile(__dirname + '/prospectus/index.html');
})

app.listen(process.env.PORT, function() {
  console.log('[+] Started');
});



