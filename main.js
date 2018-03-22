#!/usr/bin/env node

var lib = require("./lib.js");

// parse command line
const commandLineArgs = require('command-line-args');
const optionDefinitions = [
    {
        name: 'help',
        alias: 'h',
        type: Boolean,
        description:'Print this usage guide.'
    },
    {
        name: 'zoom',
        alias: 'z',
        type: Number,
        description: 'Map zoom level. If not supplied this will be automatically calculated for a 1920x1080 image.'
    },
    {
        name: 'extent',
        alias: 'e',
        type: Number,
        multiple: true,
        description:'Geographic extent [minY, minX, maxY, maxX]'},
    {
        name: 'access_token',
        alias: 'a',
        type: String,
        description: 'Mapbox access_token'
    },
    {
        name: 'out_file',
        alias: 'o',
        type: String,
        description:'GeoTiff file'
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

var access_token = options.access_token;
var zoom = options.zoom;
var extent = options.extent;
var out_file = options.out_file;

// check for usage errors
if (!access_token) {
    console.log('ERROR: Incorrect usuage!');
    console.log('Please supply mapbox access_token.');
    process.exit();
}
if (!extent || 4 != extent.length) {
    console.log('ERROR: Incorrect usuage!');
    console.log('Please supply geographic extent [].');
    process.exit();
}
if (!out_file) {
    console.log('ERROR: Incorrect usuage!');
    console.log('Please supply outfile.');
    process.exit();
}
//.end

lib.buildElevationProfile({
    'extent': extent,
    'out_file': out_file,
    'simple': true,
    'zoom': zoom,
    'access_token': access_token
}, function(err) {
    if (err) {
        throw err;
    }

    console.log("Done!");
});
