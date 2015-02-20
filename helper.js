/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {
    "use strict";

    var _ = brackets.getModule("thirdparty/lodash");

    var Helper = module.exports = exports = {
        allowedCharacters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRS0123456789',
        addTrailingZeros: function(num, length) {
            var str = String(num);

            while (str.length < length) {
                str = "0" + str;
            }

            return str;
        },
        compress: function(data) {
            var compressedData = [];
            var keys = {};
            var reservedKeys = [];

            _.each(data, function(ob, i) {
                var newob = { };
                _.each(ob, function(value, prop) {
                    if (!_.has(keys, prop)) {
                        // Assign new key
                        var key = prop.slice(0, 1);
                        var keyIndex = 0;
                        while(_.indexOf(reservedKeys, key) != -1) {
                            key = Helper.allowedCharacters[keyIndex];
                            keyIndex ++;
                        }

                        keys[prop] = key;
                        reservedKeys.push(key);
                    }

                    newob[keys[prop]] = value;
                });
                compressedData.push(newob);
            });

            return {
                compressed: compressedData,
                keys: keys
            };
        }
    };

});
