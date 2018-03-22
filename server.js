#!/usr/bin/env node

var fs = require('fs');
var express = require('express');
var bodyParser = require('body-parser');
var uuid4 = require('uuid4');
var Pool = require('./workers.js').Pool;
var worker = require('./workers.js').worker;
var log = require('./logger.js').logger();
var util = require('util');

// parse command line
const commandLineArgs = require('command-line-args');
const optionDefinitions = [
    {
        name: 'help',
        alias: 'h',
        type: Boolean,
        description: 'Print this usage guide.'
    },
    {
        name: 'port',
        alias: 'p',
        type: Number,
        description: 'Server port'
    },
    {
        name: 'access_token',
        alias: 'a',
        type: String,
        description: 'Mapbox access_token'
    },
];
const options = commandLineArgs(optionDefinitions);

if (options.help) {
    const commandLineUsage = require('command-line-usage');
    const section = [
        {
            header: 'GeoTiff Elevation Generator',
            content: 'Fetches Mapbox Terrain-RGB tiles and converts them into a GeoTiff'
        },
        {
            header: 'Options',
            optionList: optionDefinitions
        }
    ];
    const usage = commandLineUsage(section);
    console.log(usage);
    process.exit();
}
//.end


var access_token = options.access_token;
if (!access_token) {
    console.log('ERROR: Incorrect usuage!');
    console.log('Please supply mapbox access_token.');
    process.exit();
}

var PROJECT = {
    name: 'Elevation',
    major: 0,
    minor: 0,
    patch: 1,
    getVersion: function() {
        return this.name
            + '-' + this.major
            + '.' + this.minor
            + '.' + this.patch;
    }
}

const app = express();

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

// ApiRoot
router.post('/job', function (req, res) {
    log.info({
        request: {
            ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            path: req.path,
            userAgent: req.headers['user-agent']
        }
    });

    log.info(req.body);

    // TODO
    //  - add job queue
    var job_id = uuid4();
    var job = Pool.run(worker);

    req.body.access_token = access_token;
    req.body.job_id = job_id
    req.body.out_file = util.format("%s/tiffs/%s.tif", process.cwd(), job_id);

    job.send({
        job_id: job_id,
        options: req.body
    })
    .on('done', function(response) {
        log.info(response);
    })
    .on('error', function(err) {
        log.error(err.message);
    });

    res.json({
        status: "ok",
        job_id: job_id,
        message: "Job has been started."
    });
});

// TileMap Resource
router.get('/job/:job_id', function (req, res) {
    log.info({
        request: {
            ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            path: req.path,
            userAgent: req.headers['user-agent']
        }
    });

    res.json({
        status: "pending",
        job_id: req.params.job_id,
        message: "Job is not finished."
    });
});


// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

app.use('/jobs', express.static('tiffs', {
        maxAge: '1d',
        redirect: false,
        setHeaders: function (res, path, stat) {
            res.set('x-timestamp', Date.now())
        }
    })
);

// MapView for datasources
app.get('/map', function (req, res) {
    log.info({
        request: {
            ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            path: req.path,
            userAgent: req.headers['user-agent']
        }
    });
    fs.readFile(__dirname + '/templates/map.html', 'utf8', function(err, text){
        res.send(text);
    });
});


// START THE SERVER
// =============================================================================
app.listen(options.port || 3000, function () {
    log.info('Starting', PROJECT.getVersion())
    log.info('Magic happens on port ' + 3000 + '!');
});
