var process = require('process');
var winston = require('winston');

exports.logger = function() {
    return new winston.Logger({
        // level: 'debug',
        level: 'verbose',
        transports: [
            new winston.transports.Console({
                // level: 'debug',
                // level: 'verbose',
                timestamp: function() {
                    return new Date().toISOString();
                },
                formatter: function(options) {
                    return options.timestamp() + ' ' +
                            '[' + winston.config.colorize(options.level, options.level.toUpperCase()) + '] ' +
                            '[PID-' + process.pid + '] ' +
                            (options.message ? options.message : '') +
                            (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '');
                }
            }),
            new winston.transports.File({
                filename: 'app.log'
            })
        ]
    });
}
