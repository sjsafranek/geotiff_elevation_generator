#!/usr/bin/env node

const Pool = require('threads').Pool;
const pool = new Pool(4);

function worker(input, done, progress) {
    var process = require('process');
    var exec = require('child_process').exec;
    var log = require(process.cwd() + '/logger.js').logger();
    var lib = require(process.cwd() + '/lib.js');

    input.options.simple = true;

    log.info("Recieved job", input);

    lib.buildElevationProfile(input.options, function(err) {
        if (err) {
            log.info(err);
            throw err;
        }

        return done({
            status: "complete",
            job_id: input.job_id
        });

    });
}

exports.Pool = pool;
exports.worker = worker;
