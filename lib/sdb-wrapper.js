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

var _ = require('lodash'),
    Q =  require('q'),
    fs = require('fs'),
    exec = require('child_process').exec;

(function() {
  'use strict';

  /**
   * Minimal wrapper around sdb.
   *
   * @param {Object} config
   * @property {String} config.sdbCmd
   */
  var SdbWrapper = function (config) {
    _.extend(this, config);

    if (!this.sdbCmd) {
      throw new Error('sdbCmd property not set on SdbWrapper');
    }
  };

  /**
   * Execute command with sdb; if this.cmd is not set,
   *
   * @returns {promise}
   */
  SdbWrapper.prototype.execute = function (command) {
    var deferred = Q.defer();

    exec(this.sdbCmd + ' ' + command, function (err, stdout, stderr) {
      if (err) {
        deferred.reject(err);
      } else if (stdout.match(/command not found/)) {
        deferred.reject(new Error(stdout));
      } else if (stdout.match(/No such file or directory/)) {
        deferred.reject(new Error(stdout));
      } else if (stderr.match(/failed/)) {
        deferred.reject(new Error(stderr));
      } else {
        deferred.resolve(stdout);
      }
    });

    return deferred.promise;
  };

  /**
   * Execute a command on the device via "sdb shell".
   *
   * @returns {promise}
   */
  SdbWrapper.prototype.shell = function (remoteCommand) {
    return this.execute('shell "' + remoteCommand + '"');
  };

  /**
   * Push a file.
   *
   * @returns {promise}
   */
  SdbWrapper.prototype.push = function (localFile, remotePath) {
    var deferred = Q.defer();

    fs.stat(localFile, function(err) {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve();
      }
    });

    return deferred.promise.then(function() {
      return this.execute('push ' + localFile + ' ' + remotePath);
    }.bind(this));
  };

  /**
   * Forward a TCP port.
   *
   * @returns {promise}
   */
  SdbWrapper.prototype.forward = function (localPort, remotePort) {
    return this.execute('forward tcp:' + localPort + ' tcp:' + remotePort);
  };

  /**
   * Turn root permission mode on/off.
   *
   * NB only works with sdb versions > 2.0
   * TODO test sdb version here and throw error if version is bad
   *
   * @param {Boolean}
   * @returns {promise}
   */
  SdbWrapper.prototype.root = function (on) {
    return this.execute('root ' + (on ? 'on' : 'off'));
  };

  module.exports = SdbWrapper;

})();
