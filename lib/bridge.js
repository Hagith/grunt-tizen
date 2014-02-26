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

var Q = require('q'),
    _ = require('lodash'),
    async = require('async'),
    path = require('path');

(function () {
  'use strict';

  /**
   * Constructor for Bridge instances.
   *
   * This encapsulates sdb and other commands which make the bridge
   * between the host and the Tizen target bridge.
   *
   * @param {Object} config Configuration for the instance
   * @property {SdbWrapper} config.sdbWrapper
   * @property {Object} [config.logger] Object with write(), error(), warn() and ok() methods
   * @property {FileLister} config.fileLister
   * @property {String} [config.tizenAppScriptPath] Path to tizen-app.sh on the device;
   * required to run stop/start/debug/install/uninstall on the device
   * @property {BrowserWrapper} config.browserWrapper
   */
  var Bridge = function (config) {
    config = config || {};

    if (!config.logger) {
      config.logger = {
        ok: console.log,
        warn: console.log,
        write: console.log,
        error: console.error
      };
    }

    if (!config.sdbWrapper) {
      throw new Error('Bridge must be initialised with the sdbWrapper instance');
    }

    if (!config.fileLister) {
      throw new Error('Bridge must be initialised with the fileLister instance');
    }

    // config.browserWrapper is optional

    config.scriptInterpreterPath = '/bin/sh';

    _.extend(this, config);
  };

  /**
   * Test whether a file exists on the device.
   *
   * @param {String} remotePath Path to test
   * @returns {promise}
   */
  Bridge.prototype.fileExists = function (remotePath) {
    var logger = this.logger;
    var cmd = 'stat ' + remotePath;

    return this.sdbWrapper.shell(cmd)
        .then(function () {
          return true;
        })
        .fail(function (err) {
          if (err.message === 'No such file or directory') {
            return false;
          }

          logger.error(err);
          throw err;
        });
  };

  /**
   * Apply chmod to a remote path.
   *
   * @param {String} remotePath Path to apply chmod to.
   * @param {String} chmod chmod string to apply, e.g. 'a+x', '0777'.
   * @returns {promise}
   */
  Bridge.prototype.chmod = function (remotePath, chmod) {
    var logger = this.logger;
    var cmd = 'chmod ' + chmod + ' ' + remotePath;

    return this.sdbWrapper.shell(cmd)
        .then(function (stdout) {
          logger.write(stdout);
          logger.ok('did chmod ' + chmod + ' on ' + remotePath);
          return;
        })
        .fail(function (err) {
          logger.error(err.message);
          logger.error('could not chmod ' + remotePath);
          throw err;
        });
  };

  /**
   * Get list of remote files.
   *
   * @param {String|Object|String[]} remoteFiles Files to install on the device;
   * if an Object, it should look like:
   *
   *   {pattern: '/home/developer/*.wgt', filter: 'latest'}
   *
   * The pattern and filter (optional) properties specify how to find the
   * files on the device; pattern is a file glob usable with ls and
   * filter can take the value 'latest', meaning return only the latest
   * matching file.
   * @returns {promise}
   */
  Bridge.prototype.listRemoteFiles = function (remoteFiles) {
    var logger = this.logger;

    if (_.isString(remoteFiles)) {
      return Q.resolve([remoteFiles]);
    }
    if (_.isArray(remoteFiles)) {
      return Q.resolve(remoteFiles);
    }

    if (_.isObject(remoteFiles)) {
      // ls -1 -c returns newest file at the top of a list of filenames
      // separated by newlines
      var cmd = 'ls -1 -c ' + remoteFiles.pattern;

      return this.sdbWrapper.shell(cmd)
          .then(function (stdout) {
            // this cleans up stdout so it contains no blank lines
            // and can be easily split
            stdout = stdout.replace(/\r/g, '');
            stdout = stdout.replace(/^\n$/g, '');

            var fileArray = stdout.split('\n');
            if (remoteFiles.filter === 'latest') {
              return [fileArray[0]];
            }
            return fileArray;
          })
          .fail(function (err) {
            logger.error('could not run ls on device');
            logger.error(err.message);
            throw err;
          });
    }
  };

  /**
   * Build a remote path composed of the basename of localFile
   * appended to remoteDir.
   * NB this needs to build Linux paths as the result will
   * represent a path on the Tizen device.
   *
   * {String} localFile Path to a local file.
   * {String} remoteDir Remote directory path.
   * @returns {String}
   */
  Bridge.prototype.getDestination = function (localFile, remoteDir) {
    var basename = path.basename(localFile);

    // remove trailing forward slashes
    remoteDir = remoteDir.replace(/\/$/, '');

    return remoteDir + '/' + basename;
  };

  /**
   * Raw sdb push.
   *
   * @param {String} localFile Path to local file to push.
   * @param {String} remotePath Full destination path for file.
   * @returns {promise}
   */
  Bridge.prototype.pushRaw = function (localFile, remotePath) {
    var logger = this.logger;

    return this.sdbWrapper.push(localFile, remotePath)
        .then(function () {
          logger.ok('pushed local:' + localFile + ' to remote:' + remotePath);
        })
        .fail(function (err) {
          if (
              err.message.match('failed to copy') ||
                  err.message.match('cannot stat') ||
                  err.message.match('device not found')) {
            logger.error(err.message);

            throw new Error('could not push file to device');
          }

          throw err;
        });
  };

  /**
   * Copy one file to the device with overwrite protection and chmod after
   * copy is successful.
   *
   * @param {String} localFile Local file to push to the device.
   * @param {String} remoteDir Remote directory to push file to.
   * @param {Boolean} overwrite If set to false, push will fail if the file
   * already exists on the device.
   * @param {String} chmod chmod command string to apply to the file after
   * copying.
   * @returns {promise}
   */
  Bridge.prototype.pushOne = function (localFile, remoteDir, overwrite, chmod) {
    var logger = this.logger;
    var remotePath = this.getDestination(localFile, remoteDir);

    var setChmod = function () {
      if (chmod) {
        return this.chmod(remotePath, chmod);
      }
    }.bind(this);

    if (overwrite) {
      return this.pushRaw(localFile, remotePath).then(setChmod);
    }

    return this.fileExists(remotePath)
        .then(function (exists) {
          if (exists) {
            logger.warn('not pushing to ' + remotePath + ' as file exists ' +
                'and overwrite is false');
            return;
          }

          return this.pushRaw(localFile, remotePath).then(setChmod);
        }.bind(this));
  };

  /**
   * Push multiple files in parallel.
   *
   * @param {String|String[]|Object} localFiles Single file path, multiple
   * file paths, or object {pattern: 'glob'}. If an object, may also
   * contain a property filter:'latest' to retrieve just the latest
   * file in the list returned by the glob.
   * @param {String} remoteDir Remote directory to copy files to.
   * @param {Boolean} overwrite If set to false and the file exists on the
   * device, all pushes after the failed push will be aborted.
   * @param {String} chmod chmod command string to apply to all files after
   * copying.
   * @returns {promise}
   */
  Bridge.prototype.push = function (localFiles, remoteDir, overwrite, chmod) {
    var bridge = this;
    var logger = this.logger;

    return this.fileLister.list(localFiles)
        .then(function (filesToPush) {
          var deferred = Q.defer();

          async.each(
              filesToPush,

              function (localFile, asyncCb) {
                bridge.pushOne(localFile, remoteDir, overwrite, chmod)
                    .then(asyncCb, asyncCb);
              },

              function (err) {
                if (err) {
                  logger.error(err);
                  deferred.reject(new Error('error while pushing files'));
                }
                else {
                  logger.ok('all files pushed');
                  deferred.resolve();
                }
              }
          );

          return deferred.promise;
        });
  };

  /**
   * Run a script on the device.
   *
   * @param {String} remoteScript Absolute path to the remote script to run.
   * @param {String[]} [args=[]] Array of arguments to pass to the script.
   * @returns {promise}
   */
  Bridge.prototype.runScript = function () {
    var remoteScript = this.scriptInterpreterPath + ' ' + arguments[0];
    var args = [];

    if (_.isArray(arguments[1])) {
      args = arguments[1];
    }

    var logger = this.logger;

    // make the actual command which will run inside the shell
    var cmd = remoteScript;

    if (args.length) {
      cmd += ' ' + args.join(' ');
    }

    logger.ok('running: ' + cmd);

    return this.sdbWrapper.shell(cmd)
        .then(function (stdout) {
          logger.write(stdout);
          return stdout;
        })
        .fail(function (err) {
          logger.error(err.message);
          throw new Error('error occurred while running command ' + cmd);
        });
  };

  /**
   * Run the tizen-app.sh script on the device with command and
   * arguments array args.
   *
   * The actual command line invoked will be:
   *
   *     tizen-app.sh command arg1 arg2...
   *
   * where arg1 and arg2 etc. may be supplied in the args argument.
   *
   * @param {String} command The tizen-app.sh script command to run.
   * @param {String[]} args Arguments to pass to tizen-app.sh.
   * @returns {promise}
   * Note that this has a different signature from other parts of the
   * API as this method is only really intended for internal use, but
   * exposed to assist in testing (and it may be useful).
   */
  Bridge.prototype.runTizenAppScript = function (command, args) {
    var script = this.tizenAppScriptPath;

    if (!script) {
      return Q.reject(new Error('cannot run tizen-app.sh as tizenAppScriptPath ' +
          'is not set on Bridge'));
    }

    var cmd = script + ' ' + command;
    if (args.length) {
      cmd += ' ' + args.join(' ');
    }

    return this.sdbWrapper.shell(cmd);
  };

  /**
   * Install a single package on the device via tizen-app.sh, which
   * wraps pkgcmd.
   *
   * @param {String} remoteFile Remote wgt file already on the
   * device, which is to be installed.
   * @returns {promise}
   */
  Bridge.prototype.installOne = function (remoteFile) {
    var logger = this.logger;

    return this.runTizenAppScript('install', [remoteFile])
        .then(function (stdout) {
          logger.write(stdout);

          if (stdout.match(/key\[end\] val\[fail\]/)) {
            logger.error('error installing package ' + remoteFile);
            logger.error(stdout);
            throw new Error('installation failed');
          }

          logger.ok('installed package ' + remoteFile);
        });
  };

  /**
   * Install one or more packages on the device.
   *
   * @param {String|Object|String[]} remoteFiles Remote files already on the
   * device, which are to be installed. See listRemoteFiles for
   * the structure.
   * @returns {promise}
   */
  Bridge.prototype.install = function (remoteFiles) {
    var logger = this.logger;

    // which files to install
    return this.listRemoteFiles(remoteFiles).then(function (filesToInstall) {
      var deferred = Q.defer();

      async.each(
          filesToInstall,

          function (fileToInstall, asyncCb) {
            this.installOne(fileToInstall).then(asyncCb, asyncCb);
          }.bind(this),

          function (err) {
            if (err) {
              logger.error(err);
              deferred.reject(new Error('error while installing package'));
            }
            else if (!filesToInstall.length) {
              logger.warn('no packages to install');
            }
            else {
              logger.ok('all packages installed');
            }

            deferred.resolve();
          }
      );

      return deferred.promise;
    }.bind(this));
  };

  /**
   * Uninstall a Tizen app by ID (i.e. the ID in the <widget> element).
   *
   * @param {String} appId Application ID (not URI)
   * @param {Boolean} stopOnFailure If true and the uninstallation fails, cb(error)
   * @returns {promise}
   */
  Bridge.prototype.uninstall = function (packageName, stopOnFailure) {
    var logger = this.logger;

    var errorHandler = function(err) {
      if (stopOnFailure) {
        throw err;
      }

      logger.warn('could not uninstall package; continuing anyway');
    };

    return this.runTizenAppScript('uninstall', [packageName])
        .then(function (stdout) {
          logger.write(stdout);

          if (stdout.match('not installed|failed')) {
            errorHandler(new Error('package ' + packageName + ' could not be uninstalled'));
          }
          else {
            logger.ok('package with name ' + packageName + ' uninstalled');
          }
        }).fail(errorHandler);
  };

  /**
   * Start/stop/debug an application; wraps wrt-launcher, so it needs
   * the app's URI rather than its ID.
   *
   * {String} subcommand 'start', 'stop' or 'debug'
   * {String} appUri URI of the application.
   * {Boolean} stopOnFailure If set to true and the launch command
   * fails, promise will be rejected; if set to false and the command
   * fails, promise will be fulfilled.
   * @returns {promise} if subcommand is 'debug', result will match /PORT (\d+)/,
   * where the captured part of the regex is the remote port number.
   */
  Bridge.prototype.launch = function (subcommand, appUri, stopOnFailure) {
    var logger = this.logger;
    var actionDone = (subcommand === 'stop' ? 'stopped' : 'launched');

    var errorHandler = function(err) {
      var warning = 'app with id ' + appUri + ' could not be ' + actionDone;
      if (stopOnFailure) {
        logger.error(warning);
        logger.error(err.message);
        throw err;
      }

      logger.warn(warning + '; continuing anyway');
    };

    return this.runTizenAppScript(subcommand, [appUri])
        .then(function (stdout) {
          if (stdout.match('running|does not exist|failed')) {
            errorHandler(new Error(stdout));
          }
          else {
            logger.write(stdout);
            logger.ok('app with id ' + appUri + ' ' + actionDone);

            // NB it's important that we give stdout back, as this is
            // parsed further in the tizen task to get the port number
            // for forwarding
            return stdout;
          }
        }, errorHandler);
  };

  /**
   * Construct the debug URL for an app on TCP port localPort.
   *
   * @param {Integer} localPort Local debug port.
   * @returns {String}
   */
  Bridge.prototype.getDebugUrl = function (localPort) {
    return 'http://localhost:' + localPort + '/inspector.html?page=1';
  };

  /**
   * Run a browser command to open the debug inspector.
   *
   * @param {String} browserCmd Command to open the browser; should include
   * a "%URL%" placeholder which is replaced with the debug URL, e.g.
   * "google-chrome %URL%"
   * @param {Integer} localPort Local port attached to the remote debug port.
   */
  Bridge.prototype.runBrowser = function (browserCmd, localPort) {
    var logger = this.logger;
    var url = this.getDebugUrl(localPort);

    if (this.browserWrapper) {
      browserCmd = browserCmd.replace('%URL%', url);

      return this.browserWrapper(browserCmd)
          .then(function (stdout) {
            logger.write(stdout);
            return stdout;
          })
          .fail(function (err) {
            logger.error(err.message);
            throw err;
          });
    }

    var msg = 'cannot run browser: no browserWrapper configured for Bridge';
    return Q.reject(new Error(msg));
  };

  /**
   * Use sdb to forward a local port to a remote debugging port on the
   * device.
   *
   * @param {Integer} localPort Local port to attach remote debug port to.
   * @param {Integer} remotePort Remote debug port on the device.
   * @return {promise}
   */
  Bridge.prototype.portForward = function (localPort, remotePort) {
    var self = this;
    var logger = this.logger;

    return this.sdbWrapper.forward(localPort, remotePort)
        .then(function (stdout) {
          var url = self.getDebugUrl(localPort);
          logger.ok('app is ready for debugging at \n' + url);
          return stdout;
        })
        .fail(function (err) {
          logger.error(err.message);
          logger.error('could not forward local port to remote port');
          throw err;
        });
  };

  /**
   * Call "sdb root on" to make future sdb commands run as root
   * on the device.
   *
   * @param {Boolean} on Set to true to set root on, false to set root off
   * @returns {promise}
   */
  Bridge.prototype.root = function (on) {
    var logger = this.logger;
    var state = (on ? 'on' : 'off');

    return this.sdbWrapper.root(on)
        .then(function (stdout) {
          logger.write(stdout);

          if (on) {
            logger.warn('*** called "sdb root ' + state + '"; ' +
                'commands now running as root ***');
          }
          else {
            logger.ok('*** called "sdb root ' + state + '"; ' +
                'commands no longer running as root ***');
          }
        })
        .fail(function (err) {
          logger.error(err.message);
          throw err;
        });
  };

  module.exports = Bridge;

})();
