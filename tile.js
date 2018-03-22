#!/usr/bin/env node
var Jimp = require("jimp");
var SphericalMercator = require("@mapbox/sphericalmercator");
var log = require(process.cwd() + '/logger.js').logger();

var Tile = function(x, y, z, url_template, options) {
    this.options = options || {};
    this.x = x;
    this.y = y;
    this.z = z;
    this.url_template = url_template;
    this._mercator = new SphericalMercator({size: this.options.tileSize || 256});
    this.image = null;
}

Tile.prototype.getBounds = function() {
    // Calculate lat lon bounds for individual tile generated from gdal2tiles
    // https://gis.stackexchange.com/questions/17278/calculate-lat-lon-bounds-for-individual-tile-generated-from-gdal2tiles
    return this._mercator.bbox(
        this.x,
        this.y,
        this.z
    );
}

Tile.prototype.fetch = function(callback) {
    var self = this;

    var url = this.url_template
                .replace('{z}', this.z)
                .replace('{x}', this.x)
                .replace('{y}', this.y);

    log.info && log.info("fetch", url);

    Jimp.read(url, function(err, image){
        if (err) {
            log.error && log.error(err.message);
            callback && callback(err);
            return;
        }
        // tiles,
        self.image = image;
        callback && callback(null, image);
    });
}

var Tiles = function(extent, zoom, url_template) {
    this.collection = [];

    var merc = new SphericalMercator({size: 256});

    //probably between 1-19 for a typical webmap
    // https://wiki.openstreetmap.org/wiki/Zoom_levels
    // http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Lon..2Flat._to_tile_numbers_2
    var xyz = merc.xyz(extent, zoom);

    // collect all tiles that are needed
    for (var x=xyz.minX-1; x<xyz.maxX+1; x++) {
        for (var y=xyz.minY-1; y<xyz.maxY+1; y++) {
            ""+url_template,
            this.collection.push(
                new Tile( x, y, zoom, url_template )
            );
        }
    }
}

Tiles.prototype.fetchTiles = function(forEach, onEnd, _idx) {
    // var tile = tiles.pop();
    var self = this;
    _idx = _idx || 0;
    var tile = this.collection[_idx];
    // console.log('fetch', tile.z, tile.x, tile.y);
    tile.fetch(function(err, image) {
        if (err) {
            log.error && log.error(err.message);
        } else {
            _idx++;
            forEach && forEach(err, tile);
        }

        if (self.collection.length > _idx) {
            self.fetchTiles(forEach, onEnd, _idx);
        } else {
            onEnd && onEnd();
        }
    });
}


exports.Tile = Tile;
exports.Tiles = Tiles;
