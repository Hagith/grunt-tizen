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

var Q = require('q');

/**
 * Create task functions for the given Bridge and TizenConfig objects,
 * returning an object with the two grunt tasks tizen_prepare and tizen.
 */
var create = function (config) {
  'use strict';
  var bridge = config.bridge;
  var tizenConfig = config.tizenConfig;

  if (!bridge) {
    return Q.reject(new Error('Bridge instance is required by makeTasks()'));
  }

  if (!tizenConfig) {
    return Q.reject(new Error('TizenConfig instance is required by makeTasks()'));
  }

  /**
   * push: push a file to the device
   *
   * @param {Object} data Configuration for the push.
   * {String} data.remoteDir Remote directory to push to; the absolute
   * path to the destination file is the basename of the local file
   * appended to this directory.
   * @property {String|String[]|Object} data.localFiles Single filename as a string,
   * an array of filenames, or an object with form {pattern: 'xxx', filter: 'yyy'},
   * where 'xxx' is a file glob and 'yyy' is a filter ('latest' is
   * the only valid value, which will sort the matched files and get
   * the one which was last modified).
   * @property {String} [data.chmod] chmod command to apply to pushed files, e.g. '+x';
   * this is passed as an argument to chmod directly, e.g.
   * '+x' would run "chmod +x <files>".
   * @property {Boolean} [data.overwrite=true] If false and the file exists on
   * the device, the local file won't be pushed.
   * @returns {promise}
   */
  var push = function (data) {
    if (!data.localFiles) {
      return Q.reject(new Error('tizen "push" action needs a localFiles property'));
    }

    if (!data.remoteDir) {
      return Q.reject(new Error('tizen "push" action needs a remoteDir property'));
    }

    // get variables from config and set defaults
    var overwrite = (data.overwrite === false ? false : true);
    var chmod = data.chmod || null;

    return bridge.push(data.localFiles, data.remoteDir, overwrite, chmod);
  };

  /**
   * install: install a wgt file on the device; NB the file needs
   * to be on the device first
   *
   * @param {Object} data Configuration for the install.
   * @property {String|String[]|Object} data.remoteFiles Full path to a file,
   * array of full paths to files, or a {pattern: xxx, filter: yyy}
   * object, where xxx is a file glob for the remote filesystem and yyy;
   * can be set to 'latest' to retrieve the last modified file retrieved
   * by the glob; this specifies the remote files to be installed
   * @returns {promise}
   */
  var install = function (data) {
    if (!data.remoteFiles) {
      return Q.reject(new Error('tizen "install" action needs a remoteFiles property'));
    }

    return bridge.install(data.remoteFiles);
  };

  /**
   * uninstall: uninstall a package by its ID
   *
   * @param {Object} data Configuration for the uninstall.
   * @property {Boolean} [data.stopOnFailure=false] If true and uninstall fails,
   * callback with error.
   * @returns {promise}
   */
  var uninstall = function (data) {
    var stopOnFailure = (data.stopOnFailure === true ? true : false);

    return tizenConfig.getMeta().then(function (meta) {
      return bridge.uninstall(meta.packageName, stopOnFailure);
    });
  };

  /**
   * script: run an arbitrary script on the device
   *
   * @param {Object} data Configuration for the script invocation.
   * @property {String} data.remoteScript Remote script to run. NB the remote
   * script is passed the following arguments by default:
   *   $1 == the package name of the widget (tizen:application.package
   *   from config.xml)
   *   $2 == the ID of the widget (tizen:application.id from config.xml)
   * @property {String[]} [data.args=[]] Additional arguments to pass to the
   * script
   * @returns {promise}
   */
  var script = function (data) {
    if (!data.remoteScript) {
      return Q.reject(new Error('tizen "script" action needs a remoteScript property'));
    }

    var args = data.args || [];

    return tizenConfig.getMeta().then(function (meta) {
      args = [meta.packageName, meta.id].concat(args);
      return bridge.runScript(data.remoteScript, args);
    });
  };

  /**
   * launch: start/stop application
   *
   * @param {Object} data Configuration for launch.
   * @property {Integer} [data.localPort=8888] local port which is forwarded to the debug port
   * for this app on the device (default=8888)
   * @property {Boolean} [data.stopOnFailure=false] set to true to stop if the
   * launch command fails
   * @property {String} [data.browserCmd] Command to open the browser at the debug URL;
   * use '%URL%' to pass the URL of the debug page into the browser
   * command line, e.g. 'google-chrome %URL%'.
   * @param {String} subcommand 'stop', 'start', or 'debug'
   * @returns {promise}
   */
  var launch = function (data, subcommand) {
    var localPort = data.localPort || '8888';
    var browserCmd = data.browserCmd || null;
    var stopOnFailure = (data.stopOnFailure === true ? true : false);

    return tizenConfig.getMeta().then(function (meta) {

      return bridge.launch(subcommand, meta.id, stopOnFailure).then(function (result) {
        if (subcommand === 'debug') {
          result = result.match(/PORT (\d+)/);
          if (!result) {
            throw new Error('no remote port available for debugging');
          }

          var remotePort = parseInt(result[1], 10);

          return bridge.portForward(localPort, remotePort).then(function () {
            if (browserCmd) {
              return bridge.runBrowser(browserCmd, localPort);
            }
          });
        }
      });
    });
  };

  // TASK DEFINITIONS (public API)
  // note that these are not grunt-specific, so they can be unit-tested
  var tizenPrepareTask = function () {
    var localScript = bridge.tizenAppScriptLocal;
    var remoteDir = bridge.tizenAppScriptDir;

    return push({
      localFiles: localScript,
      remoteDir: remoteDir,
      chmod: '+x',
      overwrite: true
    });
  };

  var tizenTask = function (data) {
    // parameters for this particular invocation
    var asRoot = data.asRoot || false;
    var action = data.action;

    if (!action) {
      return Q.reject(new Error('tizen task requires action argument'));
    }

    // arguments we'll pass to the function denoted by action
    var args = [data];

    // determine which command function to execute
    var cmd = null;

    if (action === 'push') {
      cmd = push;
    }
    else if (action === 'install') {
      cmd = install;

      // TODO temporary fix until pkgcmd works as non-root user
      asRoot = true;
    }
    else if (action === 'uninstall') {
      cmd = uninstall;
    }
    else if (action === 'script') {
      cmd = script;
    }
    // stop, start, debug; we need an extra action argument for this
    else if (action === 'start' || action === 'stop' || action === 'debug') {
      cmd = launch;
      args.push(action);
    }

    // die if the action specified doesn't map to any of the known commands
    if (!cmd) {
      return Q.reject(new Error('action "' + action + '" was not recognised as valid'));
    }

    // if we're doing this as root, do "sdb root on" first, then
    // execute the command, then "sdb root off"
    if (asRoot) {

      // turn root on, and if successful, apply the "real" command;
      // at the end turns root off again
      return bridge.root(true)
          .then(function () {
            return cmd.apply(null, args);
          })
          .finally(function () {
            // this should be called even if the bridge command fails
            return bridge.root(false);
          });
    }

    // do as normal user, not root
    return cmd.apply(null, args);
  };

  return {
    tizenPrepareTask: tizenPrepareTask,
    tizenTask: tizenTask
  };
};

module.exports = create;
