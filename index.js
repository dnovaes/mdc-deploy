// BASE SETUP 

var express    = require('express')
var session    = require('express-session');
const client   = require('./controller/connection.js');
var app        = express()
var path       = require('path');
var bodyparser = require('body-parser');
const functions  = require(__dirname+"/public/js/ext_functions.js");
var port       = process.env.PORT || 3000;
var nlp        = require(__dirname+"/public/js/natural.js");

//Routes
const user       = require('./routes/user');
const historical_learning = require('./routes/historical_learning');
const router = express.Router();

// There is a special routing method which is not derived from any HTTP method. 
// This method is used for loading middleware functions at a path for all request methods.
// app.all()

//set our default template engine to "ejs"
// which prevents the need for using file extensions. (pug, ejs...)
app.set('view engine', 'ejs');

//set views for 505, 404 and other view pages
app.set('views', path.join(__dirname, 'views'));

//set path for static files (css, images...)
app.use(express.static(path.join(__dirname, 'public')));

//parse request bodies (req.body / POST )
//app.use(bodyparser());
app.use(bodyparser.urlencoded({ extended: true}));
app.use(bodyparser.json());

app.use(session({
  secret: 'chatbot',
  resave: false,
  saveUninitialized: false,
  rolling: true

  //obs cookie time is set at signin and signup route.user function
  //cookie: { expires: new Date(253402300000000) }
  //cookie: { expires: new Date(Date.now() + 6000) }
  //cookie: { maxAge: 5000 }
}));

app.use(function(req, res, next){
  // if there's a flash message in the session request, make it available in the response, then delete it
  res.locals.sessionFlash = req.session.sessionFlash;
  res.locals.user = req.session.user;
  delete req.session.sessionFlash;

  next();
});



//load file of route configs | also called as controllers
//require('./controller/routing.js')(app, { verbose: !module.parent, express: express });

router.get('/', function (req, res){
  let adm = false;
  let exp = false;

  if(req.query){
    if(req.query.adm){
      adm = true;
    }
//    if(req.query.exp){
//      exp = true;
      res.render('index', {adm: adm, exp: exp});
/*    }else{
      res.redirect('/experimento');
    }*/
  }else{
    res.render('index', {adm: adm, exp: exp});
  }
});
router.post('/', function (req, res){
  let adm = false;
  let exp = false;
  let termName = "";

  if(req.body){
    if(req.body.termName){
      exp = true;
      termName = req.body.termName;
    }
  }
  res.render('index', {adm: adm, exp: exp, termName: req.body.termName});
});

router.get('/experimento/', function (req, res){
  res.render('preexperimento');
});

router.get('/view/', function (req, res){
  res.redirect('../');
});

router.post('/signin', user.signin);
router.post('/signup', user.signup);
router.get('/signout', user.signout);
router.get('/login', user.login);

const msgSessionTimeout = 'Tempo de Sessão expirou. Efetue login novamente.';

router.get('/dashboard/', function(req, res){

  if(!req.session.user){

    req.session.sessionFlash = {
      type: "danger",
      message: msgSessionTimeout
    }
    req.session.save(function(err) {
      res.redirect('/login');
    })
  }else{
    user.dashboard(req, res);
  }
});

router.get('/edit/', function(req, res){
  if(!req.session.user){

    req.session.sessionFlash = {
      type: "danger",
      message: msgSessionTimeout
    }
    req.session.save(function(err) {
      res.redirect('/login');
    })
  }else{
    user.edit(req, res);
  }

});

router.get('/mural_queixas/', function(req, res){
  if(!req.session.user){

    req.session.sessionFlash = {
      type: "danger",
      message: msgSessionTimeout
    }
    req.session.save(function(err) {
      res.redirect('/login');
    })
  }else{
    user.complaints(req, res);
  }
});

router.get('/user/getUserInfoById', function(req, res){
  if(!req.session.user){

    req.session.sessionFlash = {
      type: "danger",
      message: msgSessionTimeout
    }
    req.session.save(function(err) {
      res.redirect('/login');
    })
  }else{
    user.getUserInfoById(req, res);
  }
});

router.post('/update/', function(req, res){

  console.log(req.session);

  if(!req.session.user){

    req.session.sessionFlash = {
      type: "danger",
      message: msgSessionTimeout
    }
    req.session.save(function(err) {
      res.redirect('/login');
    })
  }else{
    user.update(req, res);
  }
});

router.post('/user/getUserInfoById', user.getUserInfoById)
router.post('/user/registerExperiment', user.registerExperiment)

router.post('/historical_learning/create', historical_learning.create);
router.post('/historical_learning/voteclaim', historical_learning.voteClaim);
router.post('/historical_learning/searchMostSimilarClaim', historical_learning.searchMostSimilarClaim);
router.post('/historical_learning/selectClaimById', historical_learning.selectClaimById);
router.post('/historical_learning/searchSimilarClaims', historical_learning.searchSimilarClaims);


//route that handle ajax requests
//in case of post request, all "variable" are passed in req.body
router.post('/ajax/:function', function(req, res){
    if(req.params.function === "stopwordsremovalPT"){
      //pos = part of speech flag/boolean 
      var posBool = req.body.posBool;
      var claimTagged = "";

      let keywords = [];

      if(!posBool){

        //apply stopword removal to the raw claim. return a object with the claim processed and keywords extracted

        let result = functions.stopWordsRemovalPT((req.body.claim).toLowerCase());

        //must be 'var' here instead of 'let'
        var claim = result.claim;
        keywords = result.keywords; //array containing keywords

        keywords = functions.removeRepeatedWords(keywords);
      }else{

        var words = req.body.claim.split(" ");
        claimTagged = nlp.posTagger(words);

        var claim = "";
        //just add as a claim, words that represents a NOUN (NNP,NN or NNPS);
        // NN =  noun, sigular or mass / NNS = noun, plural
        // NNP = proper noun, singular / NNPS = proper noun, plural
        var NounTags = ["NNP", "NNPS", "NN", "NNS"];

        for(var i=0; i < claimTagged.length; i++){
          NounTags.forEach(function(item, index){
            if(item == claimTagged[i][1]){
              if(claim != "") claim += " ";
              claim += claimTagged[i][0];
            }
          });
        }

        //separate the keywords based on the new claim
        keywords = claim.split(" ");

        //detecting and removing empty ''
        for(var i=0; i < keywords.length; i++){
          if (keywords[i] == ''){
            keywords.splice(i, 1);
          }
          
          //Removing some error judgment for DT as a NN
          if(keywords[i] == "I"){
            keywords.splice(i, 1);
          }
        }
      }

      //claim is the var that will be sent to the elasticsearch.
      console.log("searching for keywords: "+keywords);
      claim = { "claim" : claim, "keywords": keywords, "claimTagged": claimTagged}
      obj = JSON.stringify(claim);
      res.send(obj); 
    }
}); 

// route with parameters ex: localhost:8081/elastic/:id
router.get('/elastic/', function(req, res){
    /*
    var routePath = "Route path: "+req.originalUrl;
    var fullUrl = "Request URL: "+ "http://"+req.hostname+":"+port+req.originalUrl;

    // body content
    var body = "<p>"+routePath+"</p>";
    body+= "<p>"+fullUrl+"</p>";
    body+= "<p>Params: "+JSON.stringify(req.params)+"</p>";

    res.send(body);
    */

    let q = req.query.q;
    q.replace(/[\\$'"]/g, "\\$&");

    //API of elasticsearch.js used to connect the elastic search engine (lucene)
    let esParams = {
      index: 'cdc',
      q: q
    }
    client.search(esParams).then(function(response){
      res.send(response);
    });

    /*
    http.get('http://localhost:9200/cdc/_search?q=\''+q+'\'', function(response) {
        //console.log("Got response: " + response.statusCode);
        var str = '';

        response.on('data', function (chunk) {
              str += chunk;
         });

        response.on('end', function () {
             res.send(str);
        });
    });
    */

    //other alternatives at sending content to client
    
    //res.write();
    //res.end
    //or
    //res.set('Content-Type', 'text/html');
    //res.send(...);
});

//router contain functions that not allow the request to go beyound it (res.send)
app.use('/', router);

app.use('/public', express.static(__dirname + '/public'));


//ERRORS:
//mount the app requests with the functions
app.use(function (err, req, res, next){
    //log it
    if (!module.parent) console.error(err.stack);

    //error page
    res.status(500).render('5xx');
});

//last middleware response: 404 page error
app.use(function(req, res, next){
    res.status(404).render('404', { url: req.originalUrl });
});

// START THE SERVER
if(!module.parent) {
  app.listen(port);
  console.log("Website Server started at the port: "+port);
}
