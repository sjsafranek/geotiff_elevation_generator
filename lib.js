#!/usr/bin/env node
var fs = require("fs");
var Jimp = require("jimp");
var SphericalMercator = require("@mapbox/sphericalmercator");
var geoViewPort = require("@mapbox/geo-viewport");
var json2csv = require('json2csv').parse;
var Tile = require('./tile.js').Tile;
var Tiles = require('./tile.js').Tiles;
var process = require('process');
var exec = require('child_process').exec;
var os = require('os');
var randomstring = require("randomstring");
var log = require(process.cwd() + '/logger.js').logger();
var util = require('util');


function convertTileImageToElevation(tile, callback) {
    // Mapbox Terrain-RGB
    // https://blog.mapbox.com/global-elevation-data-6689f1d0ba65
    // https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token={your-api-token}
    // height = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
    var width = tile.image.bitmap.width,
        height = tile.image.bitmap.height,
        bounds = tile.getBounds();

    var max_lat = bounds[3],
        min_lat = bounds[1],
        max_lng = bounds[2],
        min_lng = bounds[0];

    var lngStep = (max_lng - min_lng) / width;
    var latStep = (max_lat - min_lat) / height;

    var data = [];
    for (var x=0; x<width; x++) {
        for (var y=0; y<height; y++) {
            var lng = min_lng + x*lngStep,
                lat = max_lat - y*latStep;

            var hex = tile.image.getPixelColor(x, y);
            var rgba = Jimp.intToRGBA(hex);
            var elevation = -10000 + ((rgba.r * 256 * 256 + rgba.g * 256 + rgba.b) * 0.1);

            var row = {
                tile_x: this.x,
                tile_y: this.y,
                tile_z: this.z,
                pixel_x: x,
                pixel_y: y,
                pixel_r: rgba.r,
                pixel_g: rgba.g,
                pixel_b: rgba.b,
                pixel_a: rgba.a,
                longitude: lng,
                latitude: lat,
                elevation: elevation,
                x: lng,
                y: lat,
                z: elevation
            };
            data.push(row);
        }
    }

    callback && callback(null, data);
}

// https://stackoverflow.com/questions/18052762/remove-directory-which-is-not-empty
function deleteFolderRecursive(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function(file, index){
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};


function buildElevationProfile(opts, callback) {

    // calculate zoom from output size
    if (!opts.zoom) {
        var view = geoViewPort.viewport(opts.extent, [1920, 1080]);
        opts.zoom = view.zoom;
    }

    var tiles = new Tiles(opts.extent, opts.zoom, "https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=" + opts.access_token);

    var fields = [
        'tile_x',
        'tile_y',
        'tile_z',
        'pixel_x',
        'pixel_y',
        'pixel_r',
        'pixel_g',
        'pixel_b',
        'pixel_a',
        'longitude',
        'latitude',
        'elevation'
    ];

    if (opts.simple) {
        fields = [
            'x',
            'y',
            'z'
        ]
    }

    // create temp directory for processing
    var dir = os.tmpdir() + "/terrain_RBG__" + randomstring.generate();
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }

    var c = 0;
    tiles.fetchTiles(
        function(err, tile) {
            !err && convertTileImageToElevation(tile, function(err, data) {
                if (err) {
                    throw err;
                }
                var outFile = dir + "/" + tile.z + "_" + tile.x + "_" + tile.y + ".xyz"
                var wstream = fs.createWriteStream( outFile );
                wstream.write(fields.join(',') + '\n');
                var csv = json2csv(data, {fields, header:false});
                csv += '\n';
                wstream.write(csv);
                wstream.end(function(){

                    var sortedFile = util.format("%s/%s_%s_%s_SORTED.xyz", dir, tile.z, tile.z, tile.y);
                    var tiffFile = util.format("%s/%s_%s_%s.tif", dir, tile.z, tile.z, tile.y);

                    // sort file to follow .xyz spec
                    // convert to .tif
                    var cmd = util.format("$(echo head -n 1 %s) >  %s;\n \
                              tail -n +2 %s | sort -n -t ',' -k2 -k1 >> %s;\n \
                              gdal_translate %s %s;", outFile, sortedFile, outFile, sortedFile, sortedFile, tiffFile);


                  // http://nodejs.org/api.html#_child_processes
                  // https://dzone.com/articles/execute-unix-command-nodejs
                    var child = exec(cmd, function (error, stdout, stderr) {

                        log.debug(cmd);
                        stdout && log.info('stdout: ' + stdout);
                        stderr && log.error('stderr: ' + stderr);
                        if (error !== null) {
                            log.error('exec error: ' + error);
                        }
                        c++;

                        // if all tiles are completed
                        if (c == tiles.collection.length) {

                            if (-1 == opts.out_file.indexOf(".tif") || -1 == opts.out_file.indexOf(".tiff")) {
                                opts.out_file += ".tif";
                            }

                            // http://nodejs.org/api.html#_child_processes
                            // https://dzone.com/articles/execute-unix-command-nodejs
                            // TODO:
                            //  - Clip to extent
                            // var cmd = util.format("gdalwarp -te %s %s %s %s --config GDAL_CACHEMAX 3000 -wm 3000 %s/*.tif %s", opts.extent[0], opts.extent[1], opts.extent[2], opts.extent[3], dir, opts.out_file);
                            var cmd = util.format("gdalwarp --config GDAL_CACHEMAX 3000 -wm 3000 %s/*.tif %s", dir, opts.out_file);
                            var child = exec(cmd, function (error, stdout, stderr) {
                                log.debug(cmd);
                                stdout && log.info('stdout: ' + stdout);
                                stderr && log.error('stderr: ' + stderr);
                                if (error !== null) {
                                    log.error('exec error: ' + error);
                                }
                                // remove temp directory
                                deleteFolderRecursive(dir);
                                callback && callback();
                            });
                        }

                    });
                    //.end
                });

            },
            function(){
                log.debug && log.debug('Finished fetching tiles');
            });
        }
    );

}

exports.buildElevationProfile = buildElevationProfile;
