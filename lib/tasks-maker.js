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

/**
 * Create task functions for the given Bridge and TizenConfig objects,
 * returning an object with the two grunt tasks tizen_prepare and tizen.
 */
var create = function (config) {
  'use strict';
  var bridge = config.bridge;
  var tizenConfig = config.tizenConfig;

  if (!bridge) {
    throw new Error('Bridge instance is required by makeTasks()');
  }

  if (!tizenConfig) {
    throw new Error('TizenConfig instance is required by makeTasks()');
  }

  /**
   * push: push a file to the device
   *
   * {Object} data Configuration for the push.
   * {String} data.remoteDir Remote directory to push to; the absolute
   * path to the destination file is the basename of the local file
   * appended to this directory.
   * {String|String[]|Object} data.localFiles Single filename as a string,
   * an array of filenames, or an object with form {pattern: 'xxx', filter: 'yyy'},
   * where 'xxx' is a file glob and 'yyy' is a filter ('latest' is
   * the only valid value, which will sort the matched files and get
   * the one which was last modified).
   * {String} [data.chmod] chmod command to apply to pushed files, e.g. '+x';
   * this is passed as an argument to chmod directly, e.g.
   * '+x' would run "chmod +x <files>".
   * {Boolean} [data.overwrite=true] If false and the file exists on
   * the device, the locl file won't be pushed.
   */
  var push = function (data, done) {
    if (!data.localFiles) {
      done(new Error('tizen "push" action needs a localFiles property'));
      return;
    }

    if (!data.remoteDir) {
      done(new Error('tizen "push" action needs a remoteDir property'));
      return;
    }

    // get variables from config and set defaults
    var overwrite = (data.overwrite === false ? false : true);
    var chmod = data.chmod || null;

    bridge.push(data.localFiles, data.remoteDir, overwrite, chmod, done);
  };

  /**
   * install: install a wgt file on the device; NB the file needs
   * to be on the device first
   *
   * {Object} data Configuration for the install.
   * {String|String[]|Object} data.remoteFiles Full path to a file,
   * array of full paths to files, or a {pattern: xxx, filter: yyy}
   * object, where xxx is a file glob for the remote filesystem and yyy;
   * can be set to 'latest' to retrieve the last modified file retrieved
   * by the glob; this specifies the remote files to be installed
   * {Function} done Function with signature done(err), where err is set to
   * a non-null value if an error occurs.
   */
  var install = function (data, done) {
    if (!data.remoteFiles) {
      done(new Error('tizen "install" action needs a remoteFiles property'));
      return;
    }

    bridge.install(data.remoteFiles, done);
  };

  /**
   * uninstall: uninstall a package by its ID
   *
   * {Object} data Configuration for the uninstall.
   * {Boolean} [data.stopOnFailure=false] If true and uninstall fails,
   * callback with error.
   * {Function} done Function with signature done(err), where err is set to
   * a non-null value if an error occurs.
   */
  var uninstall = function (data, done) {
    var stopOnFailure = (data.stopOnFailure === true ? true : false);

    try {
      var meta = tizenConfig.getMeta();
      bridge.uninstall(meta.packageName, stopOnFailure, done);
    } catch (err) {
      done(err);
    }
  };

  /**
   * script: run an arbitrary script on the device
   *
   * {Object} data Configuration for the script invocation.
   * {String} data.remoteScript Remote script to run. NB the remote
   * script is passed the following arguments by default:
   *   $1 == the package name of the widget (tizen:application.package
   *   from config.xml)
   *   $2 == the ID of the widget (tizen:application.id from config.xml)
   * {String[]} [data.args=[]] Additional arguments to pass to the
   * script
   * {Function} done Function to invoke with signature done(err, result).
   */
  var script = function (data, done) {
    if (!data.remoteScript) {
      done(new Error('tizen "script" action needs a remoteScript property'));
      return;
    }

    var args = data.args || [];

    try {
      var meta = tizenConfig.getMeta();
      args = [meta.packageName, meta.id].concat(args);
      bridge.runScript(data.remoteScript, args, done);
    } catch (err) {
      done(err);
    }
  };

  /**
   * launch: start/stop application
   *
   * {Object} data Configuration for launch.
   * {Integer} [data.localPort=8888] local port which is forwarded to the debug port
   * for this app on the device (default=8888)
   * {Boolean} [data.stopOnFailure=false] set to true to stop if the
   * launch command fails
   * {String} [data.browserCmd] Command to open the browser at the debug URL;
   * use '%URL%' to pass the URL of the debug page into the browser
   * command line, e.g. 'google-chrome %URL%'.
   * {String} subcommand 'stop', 'start', or 'debug'
   * {Function} done Function with signature done(err), where err is set to
   * a non-null value if an error occurs.
   */
  var launch = function (data, subcommand, done) {
    var localPort = data.localPort || '8888';
    var browserCmd = data.browserCmd || null;
    var stopOnFailure = (data.stopOnFailure === true ? true : false);

    try {
      var meta = tizenConfig.getMeta();
      var launchCb = done;

      if (subcommand === 'debug') {
        var portForwardedCb = function (err) {
          if (err) {
            done(err);
          }
          else if (browserCmd) {
            bridge.runBrowser(browserCmd, localPort, done);
          }
          else {
            done();
          }
        };

        launchCb = function (err, result) {
          if (err) {
            done(err);
          }
          else if (result) {
            result = result.match(/PORT (\d+)/);

            if (!result) {
              done(new Error('no remote port available for debugging'));
            }
            else {
              var remotePort = parseInt(result[1], 10);
              bridge.portForward(localPort, remotePort, portForwardedCb);
            }
          }
          else {
            done(new Error('could not launch app in debug mode'));
          }
        };
      }

      bridge.launch(subcommand, meta.id, stopOnFailure, launchCb);
    } catch (err) {
      done(err);
    }
  };

  var watch = function() {
//    console.log(this);
  };

  // TASK DEFINITIONS (public API)
  // note that these are not grunt-specific, so they can be unit-tested
  var tizenPrepareTask = function (done) {
    var localScript = bridge.tizenAppScriptLocal;
    var remoteDir = bridge.tizenAppScriptDir;

    push({
      localFiles: localScript,
      remoteDir: remoteDir,
      chmod: '+x',
      overwrite: true
    }, done);
  };

  var tizenTask = function (data, done) {
//    console.log(this.task);
    // parameters for this particular invocation
    var asRoot = data.asRoot || false;
    var action = data.action;

    if (!action) {
      done(new Error('tizen task requires action argument'));
      return;
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
    else if (action === 'watch') {
      cmd = watch;
    }

    // die if the action specified doesn't map to any of the known commands
    if (!cmd) {
      done(new Error('action "' + action + '" was not recognised as valid'));
      return;
    }

    // if we're doing this as root, do "sdb root on" first, then
    // execute the command, then "sdb root off"
    if (asRoot) {
      // this is the callback which will be applied after
      // root on and the "real" command, to turn off root; note
      // that this should be called even if the bridge command
      // fails
      var cb = function (err) {
        bridge.root(false, function () {
          if (err) {
            done(err);
          }
          else {
            done.apply(null, arguments);
          }
        });
      };

      // push the "root off" callback onto the args passed to the
      // "real" command
      args.push(cb);

      // turn root on, and if successful, apply the "real" command;
      // that will in turn invoke the callback which turns root off
      // again
      bridge.root(true, function (err) {
        if (err) {
          done(err);
        }
        else {
          cmd.apply(null, args);
        }
      });
    }
    // do as normal user, not root
    else {
      // the done() callback is the last argument
      args.push(done);

      // invoke our command with args
      cmd.apply(null, args);
    }
  };

  return {
    tizenPrepareTask: tizenPrepareTask,
    tizenTask: tizenTask
  };
};

module.exports = create;
