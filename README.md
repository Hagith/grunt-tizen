# grunt-tizen

grunt-tizen is a grunt plugin for installing, uninstalling, running and debugging applications on a Tizen device. It wraps [<code>sdb</code>](https://developer.tizen.org/documentation/articles/smart-development-bridge) to push files to the device and operate its command line (c.f. Android's adb); and wraps <code>pkgcmd</code> and <code>wrt-launcher</code> on the device itself to manage the application lifecycle.

# License

Apache version 2, copyright Intel Corporation Ltd. See <em>LICENSE</em> for more details.

# Contributing

Bug reports and feature requests are encouraged: please use the [github issue tracker for the project](https://github.com/01org/grunt-tizen/issues) to file them.

If you are interested in contributing code to the project, the <em>HACKING.md</em> file explains more about building grunt-tizen and running its test suite. Please ensure that any code you write has test coverage as close as possible to 100%. Pull requests should be targeted at the master branch.

# Getting started

This plugin requires **Grunt ~0.4.0**.

To use grunt-tizen in your own project, install it with:

    npm install grunt-tizen --save-dev

Once the plugin has been installed, enable it with a line of JavaScript in your Gruntfile.js:

    module.exports = function (grunt) {
      grunt.loadNpmTasks('grunt-tizen');

      // grunt.initConfig({ ... }) etc.
    };

# Dependencies

grunt-tizen has been tested on:

*   Fedora 17 Linux (64bit)
*   Windows 7 Enterprise (64bit)

grunt-tizen depends on the <code>sdb</code> command line tool. This is available for various platforms from http://download.tizen.org/tools/latest-release/.

It will also work with the version of <code>sdb</code> bundled with the Tizen IDE (located in <em>&lt;IDE root directory&gt;\tools\sdb.exe</em>).

You will also need a device running Tizen 2.1.

The device should be connected to the host running grunt via a USB connection. This plugin has not been tested with multiple simultaneous USB connections to Tizen devices. It is unlikely to work in such an environment.

If you want to use the <em>asRoot</em> option for the <code>tizen</code> task, you will need a very recent version of <code>sdb</code> with support for the "root" command. Note that this feature is undocumented, so you may have to do the following to test for its presence:

    $ sdb root on
    Switched to 'root' account mode

If you get the "Switched to 'root' account mode", your version of <code>sdb</code> supports <em>asRoot</em>.Note that all of the other tizen:* task options work with older versions of sdb, however.

**Note: the version of Tizen used for testing grunt-tizen has a broken <code>pkgcmd</code> which will not allow installation by non-root users. So at the moment, a version of <code>sdb</code> which supports <code>sdb root on/off</code> is REQUIRED. The intention is to remove this requirement once <code>pkgcmd</code> is fixed.**

Note that grunt-tizen does not package applications for deployment to Tizen. You will need another packaging tool (e.g. webtizen from the Tizen SDK or [grunt-zipup](https://github.com/01org/grunt-zipup)) to package your application into a wgt file ready for deployment.

# General configuration

The shared configuration for both tasks (<code>tizen_prepare</code> and <code>tizen</code>) should be added to <code>grunt.initConfig()</code> as follows:

    grunt.initConfig({
      // ... other task configuration ...

      tizen_configuration: {
        // location on the device to install the tizen-app.sh script to
        // (default: '/tmp')
        tizenAppScriptDir: '/home/developer/',

        // path to the config.xml file for the Tizen wgt file
        // (default: 'config.xml')
        configFile: 'data/config.xml',

        // path to the sdb command (default: process.env.SDB or 'sdb')
        sdbCmd: '/home/bilbo/bin/sdb'
      }
    });

The <code>tizen-app.sh</code> script is a shell script which runs on Tizen devices, wrapping native Tizen commands to make them simpler to call remotely via <code>sdb shell</code>. It also does some of the work to interpret error messages and output from the Tizen commands to simplify the grunt-tizen code. You can find it in the <em>scripts</em> directory of the grunt-tizen source.

Configuration for grunt-tizen tasks is described below.

# Tasks

## tizen_prepare task

This task automates pushing the <em>tizen-app.sh</em> script to the attached device, overwriting any file already in the specified location. It also applies a <code>chmod +x</code> to the script to make it executable.

The destination of the file is <code>tizenAppScriptDir</code> (from <em>tizen_configuration</em>) + <code>'tizen-app.sh'</code>.

The task requires no configuration beyond that in the <em>tizen_configuration</em> section (see above).

Run it with:

    grunt tizen_prepare

You only need to run this task once to put the script in place. Once you've done this, you should be able to use the full range of commands to the tizen task, as described below.

It is also possible to run the <em>tizen-app.sh</em> script independently of grunt-tizen: see the script for details of how to invoke it.

## tizen task

The tizen task wraps the sdb command to perform various actions with a project.

The tizen task is actually a multitask, but is typically used to run different actions on the target device, specified by an <code>action</code> option (see *Options* below).

Note that several tasks rely on metadata from a <em>config.xml</em> file (Tizen package configuration XML file). A minimal version of this might look like:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets"
        xmlns:tizen="http://tizen.org/ns/widgets"
        id="https://github.com/01org/tetesttest"
        version="0.0.1"
        viewmodes="fullscreen">
    <name>MyApplication</name>
    <icon src="icon.png"/>
    <tizen:application id="myapplictn.7dhfyr7e7f"
                       package="myapplictn"
                       required_version="2.1"/>
    <content src="index.html"/>
</widget>
```

The important data here are the <code>id</code> and <code>package</code> of the <code>tizen:application</code> element. In grunt-tizen, these are referred to as the **app ID** and the **package name** respectively. These identifiers are required by the <code>pkgcmd</code> and <code>wrt-launcher</code> commands on the Tizen device. They are automagically provided to the <em>tizen-app.sh</em> script when certain tizen task subcommands are invoked.

It is also important to note that these tasks are intended for the control of a single application, with a single <em>config.xml</em> file, and are not intended to control multiple applications simultaneously.

Having said that, the Bridge API (in <em>lib/bridge.js</em>) provides a low-level wrapper around <code>sdb</code> which is not tied to a single <em>config.xml</em> file. Alternative grunt tasks could be defined on top of the Bridge API if more flexibility were needed.

### Options

#### asRoot

type: boolean, default: false

If set to <code>true</code>, grunt-tizen attempts to run the action specified as the root user on the device. It does this by preceding the "real" action with a call to <code>sdb root on</code>, then calling the action, then calling <code>sdb root off</code>.

If the action fails, grunt-tizen will still attempt to call <code>sdb root off</code> to ensure that any further commands do not run as root.

If at any point you need to reset to the non-root user but are unable to do so via grunt-tizen, call the following directly instead:

    $ sdb root off

#### action

type: string, mandatory

The <em>action</em> option specifies which subcommand to run. The available values are:

*   **push:** Push one or more files to the device.
*   **install:** Install one or more wgt files which are already on the device.
*   **uninstall:** Uninstall an application which is already installed on the device.
*   **start:** Start an application already installed on the device.
*   **stop:** Stop an application which is running on the device.
*   **debug:** Start an application on the device in debug mode.
*   **script:** Run an arbitrary script/command on the device.

Each action has its own additional options, as described in the following sections.

### action: push

*   *localFiles*

    type: string | string[] | object, mandatory

    *   If the value is a string, it is treated as a reference to a single file on the local filesystem. If a relative path, it is resolved relative to <em>Gruntfile.js</em>.
    *   If an array of strings, this option is treated as a reference to multiple files on the local filesystem.
    *   If an object, the value should have the following format:

            localFiles: {
              pattern: 'foo/bar/*',
              filter: 'latest'
            }

        *   The <em>pattern</em> property is a file glob pattern which is matched against local files.
        *   The <em>filter</em> property is optional. Currently only <em>'latest'</em> is supported. If set to this value, only the most recent of the files matching <em>pattern</em> is pushed.

*   *remoteDir*

    type: string, mandatory

    The remote directory on the device to which the files specified by <em>localFiles</em> should be pushed.

    The destination filename for a file is the basename of the local file joined to <em>remoteDir</em>.

*   *chmod*

    type: string, default: null

    The chmod string to apply to each file after it is pushed to the device, to set permissions for the file. This can be a symbolic string (e.g. 'a+x') or an octal one (e.g. '0777').

*   *overwrite*

    type: boolean, default: true

    If set to <code>true</code>, any existing file with a matching file name will be overwritten. If <code>false</code>, the action will fail if a file with the same path already exists on the device.

### action: install

*   *remoteFiles*

    type: string | string[] | object, mandatory

    Specifies the paths of wgt files on the device which should be installed.

    See <em>push options &gt; localFiles</em> (above) for the acceptable values.

### action: uninstall

*   *stopOnFailure*

    type: boolean, default: false

    If the application cannot be uninstalled and this option is set to <code>true</code>, grunt will exit with an error. If <code>false</code>, any subsequent tasks will still run even if this task failed.

### action: start

*   *stopOnFailure*

    type: boolean, default: false

    If the application cannot be started and this option is set to <code>true</code>, grunt will exit with an error. If <code>false</code>, any subsequent tasks will still run even if this task failed.

### action: stop

*   *stopOnFailure*

    type: boolean, default: false

    If the application cannot be stopped and this option is set to <code>true</code>, grunt will exit with an error. If <code>false</code>, any subsequent tasks will still run even if this task failed.

### action: debug

*   *localPort*

    type: integer, default: 8888

    If an application is started in debug mode, this specifies the local port which should be connected to the remote debug port on the device.

*   *browserCmd*

    type: string, default: null

    Command to open a browser with the debug window for the application. If set, grunt-tizen will attempt to run the specified browser.

    The string should have a format like:

        'google-chrome %URL%'

    The '%URL%' part of this provides a placeholder for grunt-tizen to insert the debug URL for the application.

    At the moment, only Google Chrome is known to work as a debug client for Tizen apps.

*   *stopOnFailure*

    type: boolean, default: false

    If the application cannot be started and this option is set to <code>true</code>, grunt will exit with an error. If <code>false</code>, any subsequent tasks will still run even if this task failed.

    Note that if you are debugging and any step in the debug sequence fails (i.e. if a remote port cannot be established on the device, or the browserCmd is not set), grunt will exit anyway. This option only has an effect on the application start itself.

### action: script

By default, running this action invokes the specified remoteScript like this:

    remoteScript <package name> <app ID>

where:

*   <code>&lt;package name&gt;</code> is the value of the <code>widget.tizen:application@package</code> attribute in <em>config.xml</em>.
*   <code>&lt;app URI&gt;</code> is the value of the <code>widget.tizen:application@id</code> attribute in <em>config.xml</em>.

Extra arguments can be passed to the script by setting the <em>args</em> option.

Options:

*   *remoteScript*

    type: string, mandatory

    Remote path on the device of the script to be executed.

*   *args*

    type: string[], default: []

    Extra arguments to pass to the script.


## Example Gruntfile.js

    grunt.initConfig({
      tizen_configuration: {
        tizenAppScriptDir: '/home/developer/',
        configFile: 'config.xml',
        sdbCmd: 'sdb'
      },

      tizen: {
        push: {
          action: 'push',
          localFiles: {
            pattern: 'build/*.wgt',
            filter: 'latest'
          },
          remoteDir: '/home/developer/'
        },

        install: {
          action: 'install',
          remoteFiles: {
            pattern: '/home/developer/*.wgt',
            filter: 'latest'
          }
        },

        uninstall: {
          action: 'uninstall'
        },

        start: {
          action: 'start',
          stopOnFailure: true
        },

        stop: {
          action: 'stop',
          stopOnFailure: false
        },

        debug: {
          action: 'debug',
          browserCmd: 'google-chrome %URL%',
          localPort: 9090,
          stopOnFailure: true
        }
      }
    });
