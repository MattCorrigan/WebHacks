var express = require('express');
var app = express();
var needle = require("needle");
var bcrypt = require("bcrypt");
var bodyParser = require('body-parser');
var cookie = require("cookie");
var fs = require("fs");

var mysql      = require('mysql');
/*var connection = mysql.createConnection({
  host     : '******',
  user     : '******',
  password : '******',
  database : '******'
});*/

var projectString = '<div class="project"><p class="users">Made by: {users}</p><hr><div class="content"><h3>{title}</h3><p>{desc}</p></div><hr><div class="icon upvote" onclick="upvote({id})"><i class="fa fa-thumbs-up"></i> Upvote ({upvotes})</div><div class="icon view-website"><a target="_blank" href="{link}"><i class="fa fa-eye"></i> View Website</a></div><div class="icon details"><a href="../project/?id={id}"><i class="fa fa-book"></i> More Details</a></div></div>';

function parseCookies (request) {
    var list = {},
        rc = request.headers.cookie;

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
}

var assertLoggedIn = function(req, res) {
  var sid = parseCookies(req)["SID"];
  
  if (sid == undefined) {
    return undefined;
  }
  
  for (var i = 0; i < users.length; i++) {
    if (users[i].sid == sid) {
      return users[i];
    }
  }
  
  return undefined;
}
 
//connection.connect();
 
function query(q, callback) {
  connection.query(q, function (error, results, fields) {
    if (error) throw error;
    callback(results);
  });
}

var genSID = function() {
  var sid = "";
  for (var i = 0; i < 15; i++) {
    sid += Math.floor(Math.random() * 9);
  }
  return sid;
}

var User = function(username, email, fn, ln, sid) {
  this.username = username;
  this.email= email;
  this.firstname = fn;
  this.lastname = ln;
  this.sid = genSID();
};

var users = [];

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

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
    console.log(req.query.e + " has registered!");
    subscribe(req.query.e, req.query.fn, req.query.ln);
  }
  res.redirect('../thanks/');
});

function escape(text) {
  return mysql.escape(text); // just making the function call shorter and easier to understand
}

function isUsernameTaken(name, callback) {
  query("SELECT * FROM Users WHERE Username = " + escape(name), function(results) {
    if (results.length == 0) {
      callback(false);
      return;
    }
    callback(true);
  });
}

function isEmailTaken(email, callback) {
  query("SELECT * FROM Users WHERE Email = " + escape(email), function(results) {
    if (results.length == 0) {
      callback(false);
      return;
    }
    callback(true);
  });
}

function addUser(firstName, lastName, username, email, password) {
  var hashedPass = bcrypt.hashSync(password, 10);
  connection.query("INSERT INTO Users (`Username`, `Password`, `Email`, `First`, `Last`) VALUES (?, ?, ?, ?, ?);", [username, hashedPass, email, firstName, lastName], function(err, results) {
    if (err) { throw err; }
  });
}

app.get('/createAccount', function (req, res) {
  if (req.query.fn && req.query.ln && req.query.u && req.query.p && req.query.e) {
    isUsernameTaken(req.query.u, function(isTaken) {
      if (isTaken) {
        res.redirect("/create/?error=2");
        return;
      } else {
        isEmailTaken(req.query.e, function(isTaken) {
          
          if (isTaken) {
            res.redirect('/create/?error=3');
            return;
          } else {
            addUser(req.query.fn, req.query.ln, req.query.u, req.query.e, req.query.p);
            res.redirect('../login');
            return;
          }
        });
      }
    });
  } else {
    res.redirect('/create/?error=1');
    return;
  }
});

app.get("/publish", function(req, res) {
  var user = assertLoggedIn(req, res);
  if(user !== undefined) {
    res.sendfile("./public/publish/publish.html");
  } else {
    res.redirect("../login");
  }
});

var addProject = function(u, username, name, link, github, desc, callback) {
  connection.query("SELECT Title FROM Projects WHERE Username=?", [u],function(err, results) {
    
    if (results.length > 0) {
      callback(false);
    } else {
      connection.query("INSERT INTO Projects (`Username`, `Title`, `Link`, `GitHub`, `Description`) VALUES (?, ?, ?, ?, ?);", [username, name, link, github, desc], function(err, results) {
        if (err) { throw err; }
        callback(true);
      });
    }
  });
}

app.post('/publishProj', function(req, res) {
  var user = assertLoggedIn(req, res);
  if(user !== undefined) {
    if (req.body.pname && req.body.plink && req.body.pgithub && req.body.pdesc && req.body.pauthors) {
      addProject(user.username, req.body.pauthors, req.body.pname, req.body.plink, req.body.pgithub, req.body.pdesc.replace(/\n/g, "<br>"), function(added) {
        if (added) {
          res.redirect("../dashboard");
        } else {
          res.redirect("../publish/?error=2")
        }
      });
    } else {
      res.redirect("../publish/?error=1");
    }
  } else {
    res.redirect("../login");
  }
});

function login(username, password, callback) {
  connection.query("SELECT * from Users WHERE Username = ?", [username], function(err, results) {
    if (results.length == 0) {
      // no such username
      callback(false);
      return;
    }
    
    var user = results[0];
    
    if (!bcrypt.compareSync(password, user.Password)) {
      // incorrect password
      callback(false);
      return;
    }
    
    callback(true, user.Username, user.Email, user.Firstname, user.Lastname);
    
  });
}

app.post('/login', function(req, res) {
  if (req.body.u && req.body.p) {
    login(req.body.u, req.body.p, function(loggedIn, username, email, fn, ln) {
      if (!loggedIn) {
        res.redirect("./?error=2");
        return;
      }
      var u = new User(username, email, fn, ln);
      users.push(u);
      res.setHeader('Set-Cookie', cookie.serialize('SID', u.sid, {
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 7 // 1 week 
      }));
      res.redirect("../dashboard");
    });
  } else {
    res.redirect("./?error=1");
  }
});

var contains = function(needle) {
    // Per spec, the way to identify NaN is that it is not equal to itself
    var findNaN = needle !== needle;
    var indexOf;

    if(!findNaN && typeof Array.prototype.indexOf === 'function') {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function(needle) {
            var i = -1, index = -1;

            for(i = 0; i < this.length; i++) {
                var item = this[i];

                if((findNaN && item !== item) || item === needle) {
                    index = i;
                    break;
                }
            }

            return index;
        };
    }

    return indexOf.call(this, needle) > -1;
};

function putInInfo(string, results, i, user) {
  var s = string.replace("{title}", results[i].Title).replace("{upvotes}", results[i].Upvotes).replace("{desc}", results[i].Description.substring(0, 200) + "...").replace("{description}", results[i].Description).replace("{link}", results[i].Link).replace("{link}", results[i].Link).replace("{users}", results[i].Username).replace("{id}", results[i].Id).replace("{id}", results[i].Id);
  
  if (user !== undefined) {
    var upvoters = results[i].Upvoters.split("|");
    if (contains.call(upvoters, user.username)) {
      s = s.replace("Upvote", "Upvoted");
    }
  }
  
  return s;
}

function getDashboard(req, callback) {
  
  connection.query("SELECT * FROM Projects ORDER BY Upvotes", [], function(err, results) {
  
    var fullProjectsString = "";
  
    var user = assertLoggedIn(req, undefined);
  
    for (var i = 0; i < results.length; i++) {
      var s = putInInfo(projectString, results, i, user);
      
      fullProjectsString += s;
    }
  
    fs.readFile('./public/dashboard/dashboard.html', 'utf8', function (err,data) {
      if (err) {
        console.log(err);
        return "500 Server Error"
      }
      
      callback(data.replace("{projects}", fullProjectsString));
      
    });
  });
}

app.get('/dashboard/', function(req, res) {
  var user = assertLoggedIn(req, res);
  if(user !== undefined) {
    getDashboard(req, function(data) {
      res.send(data);
    })
  } else {
    res.redirect("../login");
  }
});

function upvote(req, res, id, sid) {
  connection.query("SELECT * FROM Projects WHERE Id=?", [id], function(err, results) {
    var upvoters = results[0].Upvoters.split("|");
    var user = assertLoggedIn(req, res);
    if (user == undefined) { return; }
    for (var i = 0; i < upvoters.length; i++) {
      if (upvoters[i] == user.username) {
        return;
      }
    }
    
    connection.query("UPDATE Projects SET Upvotes=?, Upvoters=? WHERE Id=?", [results[0].Upvotes+1, results[0].Upvoters + user.username + "|",id], function(err, results) {})
  });
}

app.post("/upvote", function(req, res) {
  var id = req.body.id;
  var sid = req.body.sid;
  
  upvote(req, res, id, sid);
  res.redirect("back");
});

function getProject(req, results, callback) {
  
    var user = assertLoggedIn(req, undefined);
    
    fs.readFile('./public/project/project.html', 'utf8', function (err,data) {
      if (err) {
        console.log(err);
        return "500 Server Error"
      }
      
      callback(putInInfo(data, results, 0, user));
      
    });
}

app.get("/project", function(req, res) {
  var id = req.query.id;
  if (id == undefined) {
    res.redirect("../dashboard");
    return;
  }
  
  connection.query("SELECT * FROM Projects WHERE Id=?", [id], function(err, results) {
    
    if (results.length == 0) {res.redirect("../dashboard");return;}
    
    getProject(req, results, function(string) {
      res.send(string);
    });
  });
})

app.listen(process.env.PORT, function() {
  console.log('[+] Started Server');
});



