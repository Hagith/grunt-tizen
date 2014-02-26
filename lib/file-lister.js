/**
 * Copyright 2013 Intel Corporate Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var fs = require('fs');
var _ = require('lodash');
var glob = require('glob');
var Q =  require('q');

/**
 * Object for local filesystem listing.
 */
module.exports = (function () {
  'use strict';

  return {
    /**
     * Stat the filenames in filePaths and return the latest (NB this
     * uses node to process the directory, not ls).
     *
     * @param {Array} filePaths
     * @returns String
     */
    getLatest: function (filePaths) {
      if (filePaths.length > 1) {
        // sort so latest file is first in the list
        var sortFn = function(a, b) {
          var aTime = fs.statSync(a).mtime.getTime();
          var bTime = fs.statSync(b).mtime.getTime();
          return bTime - aTime;
        };

        filePaths = filePaths.sort(sortFn);
      }

      return filePaths[0];
    },

    /**
     * Get a list of local files which optionally match a pattern and
     * filters.
     *
     * Note that if you pass a string or string array, you'll just
     * get it back: this is just here to normalise and check the format
     * of the localFiles, not test whether the files exist.
     *
     * @param {String|Object|String[]} localFiles Spec for finding a list
     * of local files. If an Object, it should look like:
     *
     *   {pattern: '/home/developer/*.wgt', filter: 'latest'}
     *
     * The pattern and filter (optional) properties specify how to find the
     * files on the device; pattern is a file glob usable with ls and
     * filter can take the value 'latest', meaning install only the latest
     * matching file.
     * @returns {Array|promise} filename array or promise of glob() result
     */
    list: function (localFiles) {
      var self = this;

      if (_.isString(localFiles)) {
        return Q.resolve([localFiles]);
      }

      if (_.isArray(localFiles)) {
        return Q.resolve(localFiles);
      }

      if (_.isObject(localFiles)) {
        // get a list of files and apply a filter
        var pattern = localFiles.pattern;
        var deferred = Q.defer();

        try {
          glob(pattern, function(err, files) {
            if (err) {
              deferred.reject(err);
            } else {
              // apply filters
              if (localFiles.filter === 'latest') {
                deferred.resolve([self.getLatest(files)]);
              } else {
                deferred.resolve(files);
              }
            }
          });
        } catch (err) {
          deferred.reject(err);
        }

        return deferred.promise;
      }

      var msg = 'localFiles parameter was not valid; ' +
                'use a string, string array, or pattern object';
      return Q.reject(new Error(msg));
    }
  };
})();
