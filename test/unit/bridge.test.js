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
var chai = require('chai')
chai.should();
chai.use(require('chai-as-promised'));
require('mocha-as-promised')();
var expect = chai.expect;

var sinon = require('sinon'),
    Q = require('q');

var Bridge = require('../../lib/bridge');

describe('Bridge', function () {
  /**
   * NB these tests don't test whether the logger is invoked with
   * the right strings: they just test that the sdb wrapper and
   * file lister are invoked correctly, and that the responses are
   * parsed properly, returning the correct values to the callback
   */
  var logger = {
    write: function () {
    },
    ok: function () {
    },
    error: function () {
    },
    warn: function () {
    }
  };

  var sdbWrapper = {
    execute: function (command) {
    },
    shell: function (remoteCommand) {
    },
    push: function (localFile, remotePath) {
    },
    forward: function () {
    },
    root: function () {
    }
  };

  var fileLister = {
    list: function (localFiles) {
    }
  };

  var bridge = new Bridge({
    logger: logger,
    sdbWrapper: sdbWrapper,
    fileLister: fileLister
  });

  var mockSdbWrapper;
  var mockBridge;
  var mockLogger;
  var sandbox;
  beforeEach(function () {
    mockSdbWrapper = sinon.mock(sdbWrapper);
    mockBridge = sinon.mock(bridge);
    mockLogger = sinon.mock(logger);
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    mockSdbWrapper.restore();
    mockBridge.restore();
    mockLogger.restore();
    sandbox.restore();
  });

  // useful matcher aliases
  var anError = sinon.match.instanceOf(Error);

  it('should create a default console logger if none is supplied', function () {
    var logger = new Bridge({
      sdbWrapper: {},
      fileLister: {}
    }).logger;

    logger.write.should.equal(console.log);
    logger.ok.should.equal(console.log);
    logger.warn.should.equal(console.log);
    logger.error.should.equal(console.error);
  });

  it('should require sdbWrapper property on creation', function () {
    var testConstruct = function () {
      new Bridge({
        logger: {}
      })
    };

    var expected = 'Bridge must be initialised with the sdbWrapper instance';
    expect(testConstruct).to.throw(expected);
  });

  it('should require fileLister property on creation', function () {
    var testConstruct = function () {
      new Bridge({
        logger: {},
        sdbWrapper: {}
      })
    };

    var expected = 'Bridge must be initialised with the fileLister instance';
    expect(testConstruct).to.throw(expected);
  });

  describe('fileExists()', function () {
    var remotePath = '/tmp/foo.txt';

    it('should return true if file exists', function () {
      mockSdbWrapper.expects('shell')
          .withArgs('stat ' + remotePath)
          .returns(Q.resolve())
          .once();

      var result = bridge.fileExists(remotePath);

      mockSdbWrapper.verify();
      return result.should.eventually.equal(true);
    });

    it('should return false if file does not exist', function () {
      mockSdbWrapper.expects('shell')
          .withArgs('stat ' + remotePath)
          .returns(Q.reject(new Error('No such file or directory')))
          .once();

      var result = bridge.fileExists(remotePath);

      mockSdbWrapper.verify();
      return result.should.eventually.equal(false);
    });

    it('should fail if error occurs when invoking sdb', function () {
      mockSdbWrapper.expects('shell')
          .withArgs('stat ' + remotePath)
          .returns(Q.reject(new Error()))
          .once();

      var result = bridge.fileExists(remotePath);

      mockSdbWrapper.verify();
      return result.should.be.rejectedWith(Error);
    });
  });

  describe('chmod()', function () {
    var remotePath = '/tmp/somescript.sh';
    var chmodStr = '+x';

    it('should resolve if chmod worked', function () {
      mockSdbWrapper.expects('shell')
          .withArgs('chmod ' + chmodStr + ' ' + remotePath)
          .returns(Q.resolve())
          .once();

      var result = bridge.chmod(remotePath, chmodStr);

      mockSdbWrapper.verify();
      return result.should.be.fulfilled;
    });

    it('should reject if chmod failed', function () {
      mockSdbWrapper.expects('shell')
          .withArgs('chmod ' + chmodStr + ' ' + remotePath)
          .returns(Q.reject(new Error()))
          .once();

      var result = bridge.chmod(remotePath, chmodStr);

      mockSdbWrapper.verify();
      return result.should.be.rejectedWith(Error);
    });
  });

  describe('listRemoteFiles()', function () {
    it('should return file path passed in if it is a string', function () {
      var filename = '/tmp/package.wgt';
      var expected = [filename];

      return bridge.listRemoteFiles(filename).should.be.eventually.eql(expected);
    });

    it('should return file paths passed in if passed an array', function () {
      var filenames = ['/tmp/package.wgt', '/tmp/package2.wgt'];
      var expected = filenames;

      return bridge.listRemoteFiles(filenames).should.be.eventually.eql(expected);
    });

    it('should fail if ls fails on the sdb shell', function () {
      var filespec = {pattern: '/tmp/*.wgt'};

      mockSdbWrapper.expects('shell')
          .withArgs('ls -1 -c ' + filespec.pattern)
          .returns(Q.reject(new Error()))
          .once();

      var result = bridge.listRemoteFiles(filespec);

      mockSdbWrapper.verify();
      return result.should.be.rejectedWith(Error);
    });

    it('should return matching files if ls successful', function () {
      var filespec = {pattern: '/tmp/*.wgt'};
      var stdout = 'young.wgt\nold.wgt';
      var expected = ['young.wgt', 'old.wgt'];

      mockSdbWrapper.expects('shell')
          .withArgs('ls -1 -c ' + filespec.pattern)
          .returns(Q.resolve(stdout))
          .once();

      var result = bridge.listRemoteFiles(filespec);

      mockSdbWrapper.verify();
      return result.should.be.eventually.eql(expected);
    });

    it('should callback with first file in list if filter set to "latest"', function () {
      var filespec = {pattern: '/tmp/*.wgt', filter: 'latest'};
      var stdout = 'young.wgt\nold.wgt';
      var expected = ['young.wgt'];

      mockSdbWrapper.expects('shell')
          .withArgs('ls -1 -c ' + filespec.pattern)
          .returns(Q.resolve(stdout))
          .once();

      var result = bridge.listRemoteFiles(filespec);

      mockSdbWrapper.verify();
      return result.should.be.eventually.eql(expected);
    });
  });

  describe('getDestination()', function () {
    it('should join basename of local file to remote directory', function () {
      var localFile = 'build/package.wgt';
      var remoteDir = '/home/developer/';
      var expectedRemotePath = '/home/developer/package.wgt';
      bridge.getDestination(localFile, remoteDir).should.eql(expectedRemotePath);
    });
  });

  describe('pushRaw()', function () {
    var localFile = 'build/package.wgt';
    var remotePath = '/home/developer/package.wgt';

    it('should resolve if sdb push successful', function () {
      mockSdbWrapper.expects('push')
          .withArgs(localFile, remotePath)
          .returns(Q.resolve())
          .once();

      var result = bridge.pushRaw(localFile, remotePath);

      mockSdbWrapper.verify();
      return result.should.be.fulfilled;
    });

    it('should return error thrown by sdb push', function () {
      mockSdbWrapper.expects('push')
          .withArgs(localFile, remotePath)
          .returns(Q.reject(new Error()))
          .once();

      var result = bridge.pushRaw(localFile, remotePath);

      mockSdbWrapper.verify();
      return result.should.be.rejectedWith(Error);
    });

    it('should return error if sdb stderr indicates ' +
        'that push failed, even if exit code is good', function () {

      mockSdbWrapper.expects('push')
          .withArgs(localFile, remotePath)
          .returns(Q.reject(new Error('failed to copy')))
          .once();

      mockSdbWrapper.expects('push')
          .withArgs(localFile, remotePath)
          .returns(Q.reject(new Error('cannot stat')))
          .once();

      return Q.all([
        bridge.pushRaw(localFile, remotePath).should.be.rejectedWith('could not push file to device'),
        bridge.pushRaw(localFile, remotePath).should.be.rejectedWith('could not push file to device'),
        mockSdbWrapper.verify()
      ]);
    });
  });

  describe('pushOne()', function () {
    var localFile = 'build/package.wgt';
    var remoteDir = '/home/developer/';
    var expectedRemotePath = '/home/developer/package.wgt';

    it('should resolve if overwrite false, no chmod, ' +
        'file doesn\'t exist and push succeeds', function (done) {
      var overwrite = false;
      var chmod = null;

      var getDestinationSpy = sandbox.spy(bridge, 'getDestination');
      var pushRawSpy = sandbox.spy(bridge, 'pushRaw');

      mockBridge.expects('fileExists')
          .withArgs(expectedRemotePath)
          .returns(Q.resolve(false))
          .once();

      mockSdbWrapper.expects('push')
          .withArgs(localFile, expectedRemotePath)
          .returns(Q.resolve())
          .once();

      var result = bridge.pushOne(localFile, remoteDir, overwrite, chmod);

      result
          .then(function () {
            mockBridge.verify();
            mockSdbWrapper.verify();
            getDestinationSpy.calledOnce.should.be.true;
            pushRawSpy.calledOnce.should.be.true;
            done();
          })
          .fail(done);
    });

    it('should log warning and resolve if overwrite false, ' +
        'no chmod and file exists', function (done) {
      var overwrite = false;
      var chmod = null;

      var loggerSpy = sandbox.spy(logger, 'warn');
      var getDestinationSpy = sandbox.spy(bridge, 'getDestination');
      var pushSpy = sandbox.spy(sdbWrapper, 'push');

      mockBridge.expects('fileExists')
          .withArgs(expectedRemotePath)
          .returns(Q.resolve(true))
          .once();

      bridge.pushOne(localFile, remoteDir, overwrite, chmod)
          .then(function () {
            mockBridge.verify();
            mockSdbWrapper.verify();
            loggerSpy.calledOnce.should.be.true;
            getDestinationSpy.calledOnce.should.be.true;
            pushSpy.notCalled.should.be.true;
            done();
          })
          .fail(done);
    });

    it('should fail if overwrite true, no chmod, but push fails', function (done) {
      var overwrite = true;
      var chmod = null;

      var getDestinationSpy = sandbox.spy(bridge, 'getDestination');
      mockSdbWrapper.expects('push')
          .withArgs(localFile, expectedRemotePath)
          .returns(Q.reject(new Error()))
          .once();

      bridge.pushOne(localFile, remoteDir, overwrite, chmod)
          .then(function () {
            done(new Error('this should be rejected but was fulfilled'));
          })
          .fail(function () {
            mockSdbWrapper.verify();
            getDestinationSpy.calledOnce.should.be.true;
            done();
          });
    });

    it('should fail if overwrite false and the fileExists() ' +
        'throws an error', function (done) {
      var overwrite = false;
      var chmod = null;

      var getDestinationSpy = sandbox.spy(bridge, 'getDestination');
      mockBridge.expects('fileExists')
          .withArgs(expectedRemotePath)
          .returns(Q.reject(new Error()))
          .once();

      bridge.pushOne(localFile, remoteDir, overwrite, chmod)
          .then(function () {
            done(new Error('this should be rejected but was fulfilled'));
          })
          .fail(function () {
            mockBridge.verify();
            getDestinationSpy.calledOnce.should.be.true;
            done();
          });
    });

    it('should run chmod on pushed file if chmod argument supplied', function (done) {
      var overwrite = true;
      var chmod = '+x';

      var getDestinationSpy = sandbox.spy(bridge, 'getDestination');
      mockSdbWrapper.expects('push')
          .withArgs(localFile, expectedRemotePath)
          .returns(Q.resolve())
          .once();
      mockBridge.expects('chmod')
          .withArgs(expectedRemotePath, chmod)
          .returns(Q.resolve())
          .once();

      bridge.pushOne(localFile, remoteDir, overwrite, chmod)
          .then(function () {
            mockSdbWrapper.verify();
            mockBridge.verify();
            getDestinationSpy.calledOnce.should.be.true;
            done();
          })
          .fail(done);
    });
  });

  describe('push()', function () {
    it('should fail if local files can\'t be listed', function () {
      var stub = sandbox.stub(fileLister, 'list');
      stub.returns(Q.reject(new Error()));

      var result = bridge.push('build/*.wgt', '/home/developer', true, '+x');
      return result.should.be.rejectedWith(Error);
    });

    it('should fail if any push fails', function (done) {
      // stub out the file lister to return two file names
      var stub = sandbox.stub(fileLister, 'list');
      var localFiles = ['build/one.wgt', 'build/two.wgt'];
      stub.returns(Q.resolve(localFiles));

      // mock out the pushes so that the second push fails
      mockBridge.expects('pushOne')
          .withArgs('build/one.wgt', '/home/developer', true, '+x')
          .returns(Q.resolve())
          .once();

      // second push fails
      mockBridge.expects('pushOne')
          .withArgs('build/two.wgt', '/home/developer', true, '+x')
          .returns(Q.reject(new Error('push failed')))
          .once();

      bridge.push('build/*.wgt', '/home/developer', true, '+x')
          .then(function () {
            done(new Error('this should fail'));
          })
          .fail(function (err) {
            mockBridge.verify();
            done();
          });
    });

    it('should resolve if all local files are pushed', function (done) {
      // stub out the file lister to return two file names
      var stub = sandbox.stub(fileLister, 'list');
      var localFiles = ['build/one.wgt', 'build/two.wgt'];
      stub.returns(Q.resolve(localFiles));

      // mock out the pushes
      mockBridge.expects('pushOne')
          .withArgs('build/one.wgt', '/home/developer', true, '+x')
          .returns(Q.resolve())
          .once();

      mockBridge.expects('pushOne')
          .withArgs('build/two.wgt', '/home/developer', true, '+x')
          .returns(Q.resolve())
          .once();

      bridge.push('build/*.wgt', '/home/developer', true, '+x')
          .then(function () {
            mockBridge.verify();
            done();
          })
          .fail(done);
    });
  });

  describe('runScript()', function () {
    it('should fail if script fails on device', function (done) {
      var cmd = '/home/developer/dumpstorage.sh';

      var err = new Error();

      mockSdbWrapper.expects('shell')
          .withArgs(bridge.scriptInterpreterPath + ' ' + cmd)
          .returns(Q.reject(err))
          .once();

      bridge.runScript(cmd)
          .then(function () {
            done(new Error('this should fail'));
          })
          .fail(function () {
            mockSdbWrapper.verify();
            done();
          });
    });

    it('should resolve if script succeeds on device', function (done) {
      var cmd = '/home/developer/dumpstorage.sh';

      mockSdbWrapper.expects('shell')
          .withArgs(bridge.scriptInterpreterPath + ' ' + cmd)
          .returns(Q.resolve(''))
          .once();

      bridge.runScript(cmd)
          .then(function () {
            mockSdbWrapper.verify();
            done();
          })
          .fail(done);
    });

    it('should add arguments to the command if supplied', function (done) {
      var args = ['arg1', 'arg2', 'arg3'];
      var cmd = '/home/developer/dumpstorage.sh';
      var expected = '/home/developer/dumpstorage.sh arg1 arg2 arg3';

      mockSdbWrapper.expects('shell')
          .withArgs(bridge.scriptInterpreterPath + ' ' + expected)
          .returns(Q.resolve())
          .once();

      bridge.runScript(cmd, args)
          .then(function () {
            mockSdbWrapper.verify();
            done();
          })
          .fail(done);
    });
  });

  describe('runTizenAppScript()', function () {
    it('should fail if tizenAppScriptPath property not set', function () {
      var bridge = new Bridge({
        logger: logger,
        fileLister: fileLister,
        sdbWrapper: sdbWrapper
      });

      return bridge.runTizenAppScript('start', [])
          .should.be.rejectedWith(Error);
    });

    it('should run tizen-app.sh on device with specified command', function () {
      var bridge = new Bridge({
        logger: logger,
        fileLister: fileLister,
        sdbWrapper: sdbWrapper,
        tizenAppScriptPath: '/home/developer/tizen-app.sh'
      });

      mockSdbWrapper.expects('shell')
          .withArgs('/home/developer/tizen-app.sh start id1 uri2')
          .returns(Q.resolve(''))
          .once();

      // test that no args also works
      mockSdbWrapper.expects('shell')
          .withArgs('/home/developer/tizen-app.sh start')
          .returns(Q.resolve(''))
          .once();

      // test that errors are propagated correctly
      mockSdbWrapper.expects('shell')
          .withArgs('/home/developer/tizen-app.sh start')
          .returns(Q.reject(new Error()))
          .once();

      return Q.all([
        bridge.runTizenAppScript('start', ['id1', 'uri2']).should.be.fulfilled,
        bridge.runTizenAppScript('start', []).should.be.fulfilled,
        bridge.runTizenAppScript('start', []).should.be.rejectedWith(Error),
        mockSdbWrapper.verify()
      ]);
    });

  });

  describe('installOne()', function () {
    var remoteFile = '/home/developer/app.wgt';

    it('should fail if wrt-installer fails', function (done) {
      mockBridge.expects('runTizenAppScript')
          .withArgs('install', [remoteFile])
          .returns(Q.reject(new Error()))
          .once();

      // case where wrt-installer fails but returns valid exit code
      mockBridge.expects('runTizenAppScript')
          .withArgs('install', [remoteFile])
          .returns(Q.resolve('key[end] val[fail]'))
          .once();

      Q.all([
            bridge.installOne(remoteFile).should.be.rejectedWith(Error),
            bridge.installOne(remoteFile).should.be.rejectedWith(Error, 'installation failed')
          ])
          .then(function () {
            mockBridge.verify();
            done();
          })
          .fail(done);
    });

    it('should resolve if wrt-installer succeeds', function (done) {
      mockBridge.expects('runTizenAppScript')
          .withArgs('install', [remoteFile])
          .returns(Q.resolve(''))
          .once();

      bridge.installOne(remoteFile)
          .then(function () {
            mockBridge.verify();
            done();
          })
          .fail(done);
    });
  });

  describe('install()', function () {
    var remoteFilesSpec = {pattern: '/home/developer/*.wgt', filter: 'latest'};
    var remoteFileNewest = '/home/developer/newest.wgt';
    var remoteFileOldest = '/home/developer/oldest.wgt';
    var remoteFiles = [remoteFileNewest, remoteFileOldest];

    it('should fail if the remote file listing fails', function (done) {
      mockBridge.expects('listRemoteFiles')
          .withArgs(remoteFilesSpec)
          .returns(Q.reject(new Error()))
          .once();

      bridge.install(remoteFilesSpec)
          .then(function () {
            done(new Error('this should fail'))
          })
          .fail(function () {
            mockBridge.verify();
            done();
          });


    });

    it('should fail if any single install fails', function (done) {
      mockBridge.expects('listRemoteFiles')
          .withArgs(remoteFilesSpec)
          .returns(Q.resolve(remoteFiles))
          .once();

      mockBridge.expects('installOne')
          .withArgs(remoteFileNewest)
          .returns(Q.resolve())
          .once();

      mockBridge.expects('installOne')
          .withArgs(remoteFileOldest)
          .returns(Q.reject(new Error()))
          .once();

      bridge.install(remoteFilesSpec)
          .then(function () {
            done(new Error('this should fail'))
          })
          .fail(function () {
            mockBridge.verify();
            done();
          });
    });

    it('should display warning message if no files match', function (done) {
      mockBridge.expects('listRemoteFiles')
          .withArgs(remoteFilesSpec)
          .returns(Q.resolve([]))
          .once();

      mockLogger.expects('warn')
          .withArgs('no packages to install')
          .once();

      bridge.install(remoteFilesSpec)
          .then(function () {
            mockBridge.verify();
            mockLogger.verify();
            done();
          })
          .fail(done);
    });

    it('should resolve if all installs succeed', function (done) {
      mockBridge.expects('listRemoteFiles')
          .withArgs(remoteFilesSpec)
          .returns(Q.resolve(remoteFiles))
          .once();

      mockBridge.expects('installOne')
          .withArgs(remoteFileNewest)
          .returns(Q.resolve())
          .once();

      mockBridge.expects('installOne')
          .withArgs(remoteFileOldest)
          .returns(Q.resolve())
          .once();

      bridge.install(remoteFilesSpec)
          .then(function () {
            mockBridge.verify();
            done();
          })
          .fail(done);
    });
  });

  describe('uninstall()', function () {
    var appId = 'app1';

    it('should fail if tizen-app.sh fails and stopOnFailure is true', function () {
      var stopOnFailure = true;

      // tizen-app.sh fails with error
      mockBridge.expects('runTizenAppScript')
          .withArgs('uninstall', [appId])
          .returns(Q.reject(new Error()))
          .once();

      // tizen-app.sh stdout says "not installed"
      mockBridge.expects('runTizenAppScript')
          .withArgs('uninstall', [appId])
          .returns(Q.resolve('not installed'))
          .once();

      // tizen-app.sh stdout says "failed"
      mockBridge.expects('runTizenAppScript')
          .withArgs('uninstall', [appId])
          .returns(Q.resolve('failed'))
          .once();

      return Q.all([
        bridge.uninstall(appId, stopOnFailure).should.be.rejectedWith(Error),
        bridge.uninstall(appId, stopOnFailure).should.be.rejectedWith(Error),
        bridge.uninstall(appId, stopOnFailure).should.be.rejectedWith(Error),
        mockBridge.verify()
      ]);
    });

    it('should show warning and resolve if tizen-app.sh fails ' +
        'but stopOnFailure is false', function (done) {
      var stopOnFailure = false;

      mockBridge.expects('runTizenAppScript')
          .withArgs('uninstall', [appId])
          .returns(Q.reject(new Error()))
          .once();

      mockLogger.expects('warn')
          .withArgs('could not uninstall package; continuing anyway')
          .once();

      bridge.uninstall(appId, stopOnFailure)
          .then(function () {
            mockBridge.verify();
            mockLogger.verify();
            done();
          })
          .fail(done);
    });

    it('should resolve if tizen-app.sh succeeds', function (done) {
      var stopOnFailure = true;

      mockBridge.expects('runTizenAppScript')
          .withArgs('uninstall', [appId])
          .returns(Q.resolve(''))
          .once();

      // this is to differentiate between success and the "fails
      // but stopOnFailure set to false, so continues anyway" condition
      mockLogger.expects('ok').once();

      bridge.uninstall(appId, stopOnFailure)
          .then(function () {
            mockBridge.verify();
            mockLogger.verify();
            done();
          })
          .fail(done);
    });
  });

  describe('launch()', function () {
    var subcommand = 'start';
    var appUri = 'http://bogus.url/app1';

    it('should fail if tizen-app.sh fails and stopOnFailure is true', function (done) {
      var stopOnFailure = true;

      // tizen-app.sh has a bad exit code
      mockBridge.expects('runTizenAppScript')
          .withArgs(subcommand, [appUri])
          .returns(Q.reject(new Error('')))
          .once();

      // tizen-app.sh stdout says "does not exist"
      mockBridge.expects('runTizenAppScript')
          .withArgs(subcommand, [appUri])
          .returns(Q.resolve('does not exist'))
          .once();

      // tizen-app.sh stdout says "running"
      mockBridge.expects('runTizenAppScript')
          .withArgs(subcommand, [appUri])
          .returns(Q.resolve('running'))
          .once();

      // tizen-app.sh stdout says "failed"
      mockBridge.expects('runTizenAppScript')
          .withArgs(subcommand, [appUri])
          .returns(Q.resolve('failed'))
          .once();

      return Q.all([
        bridge.launch(subcommand, appUri, stopOnFailure).should.be.rejectedWith(Error),
        bridge.launch(subcommand, appUri, stopOnFailure).should.be.rejectedWith(Error),
        bridge.launch(subcommand, appUri, stopOnFailure).should.be.rejectedWith(Error),
        bridge.launch(subcommand, appUri, stopOnFailure).should.be.rejectedWith(Error),
        mockBridge.verify(),
        mockLogger.verify()
      ]);
    });

    it('should resolve and show warning if tizen-app.sh fails ' +
        'and stopOnFailure is false', function (done) {
      var stopOnFailure = false;

      // tizen-app.sh has a bad exit code
      mockBridge.expects('runTizenAppScript')
          .withArgs(subcommand, [appUri])
          .returns(Q.reject(new Error('')))
          .once();

      // to differentiate between fail with warning and success
      mockLogger.expects('warn').once();

      bridge.launch(subcommand, appUri, stopOnFailure)
          .then(function () {
            mockBridge.verify();
            mockLogger.verify();
            done();
          })
          .fail(done);
    });

    it('should return stdout if tizen-app.sh succeeds', function (done) {
      var stopOnFailure = true;

      var stdout = 'PORT 24040';
      var stderr = '';

      mockBridge.expects('runTizenAppScript')
          .withArgs(subcommand, [appUri])
          .returns(Q.resolve(stdout))
          .once();

      // to differentiate between fail with warning and success
      mockLogger.expects('ok').once();

      bridge.launch(subcommand, appUri, stopOnFailure)
          .then(function (stdout) {
            stdout.should.be.equal(stdout);
            mockBridge.verify();
            mockLogger.verify();
            done();
          })
          .fail(done);
    });
  });

  describe('getDebugUrl()', function () {
    it('should return the debug URL for the app', function () {
      var expected = 'http://localhost:9000/inspector.html?page=1';
      bridge.getDebugUrl(9000).should.eql(expected);
    });
  });

  describe('runBrowser()', function () {
    var debugUrl = 'http://localhost:9000/';
    var browserCmd = 'foo-browser %URL%';
    var expectedCmd = 'foo-browser ' + debugUrl;

    it('should fail if browserWrapper not set', function () {

      mockBridge.expects('getDebugUrl').returns(debugUrl).once();

      var result = bridge.runBrowser(browserCmd, 9000);

      mockBridge.verify();
      return result.should.be.rejectedWith(Error);
    });

    it('should fail if browserWrapper fails', function () {
      bridge.browserWrapper = sandbox.stub();

      mockBridge.expects('getDebugUrl').returns(debugUrl).once();
      bridge.browserWrapper.withArgs(expectedCmd)
          .returns(Q.reject(new Error()));

      var result = bridge.runBrowser(browserCmd, 9000);

      mockBridge.verify();
      return result.should.be.rejectedWith(Error);
    });

    it('should resolve if browserWrapper succeeds', function () {
      bridge.browserWrapper = sandbox.stub();

      mockBridge.expects('getDebugUrl').returns(debugUrl).once();

      bridge.browserWrapper.withArgs(expectedCmd)
          .returns(Q.resolve(''));

      var result = bridge.runBrowser(browserCmd, 9000);

      mockBridge.verify();
      return result.should.be.fulfilled;
    });
  });

  describe('portForward()', function () {
    var localPort = 8888;
    var remotePort = 9000;
    var debugUrl = 'http://localhost:8888/';

    it('should fail if sdb forward fails', function () {
      mockSdbWrapper.expects('forward')
          .withArgs(localPort, remotePort)
          .returns(Q.reject(new Error()))
          .once();

      var result = bridge.portForward(localPort, remotePort);

      mockSdbWrapper.verify();
      return result.should.be.rejectedWith(Error);
    });

    it('should resolve if sdb forward succeeds', function (done) {
      mockBridge.expects('getDebugUrl')
          .withArgs(localPort)
          .returns(debugUrl)
          .once();

      mockSdbWrapper.expects('forward')
          .withArgs(localPort, remotePort)
          .returns(Q.resolve(''))
          .once();

      mockLogger.expects('ok')
          .withArgs('app is ready for debugging at \n' + debugUrl)
          .once;

      bridge.portForward(localPort, remotePort)
          .then(function () {
            mockBridge.verify();
            mockSdbWrapper.verify();
            mockLogger.verify();
            done();
          })
          .fail(done);
    });
  });

  describe('root()', function () {
    it('should fail if sdb root fails', function () {
      mockSdbWrapper.expects('root')
          .withArgs(true)
          .returns(Q.reject(new Error()))
          .once();

      var result = bridge.root(true);

      mockSdbWrapper.verify();
      return result.should.be.rejectedWith(Error);
    });

    it('should log message that root is off if root turned off', function (done) {
      mockSdbWrapper.expects('root')
          .withArgs(false)
          .returns(Q.resolve(''))
          .once();

      mockLogger.expects('ok')
          .withArgs(sinon.match(/no longer running as root/))
          .once();

      bridge.root(false)
          .then(function () {
            mockSdbWrapper.verify();
            mockLogger.verify();
            done();
          })
          .fail(done);
    });

    it('should log message that root is on if root turned on', function (done) {
      mockSdbWrapper.expects('root')
          .withArgs(true)
          .returns(Q.resolve(''))
          .once();

      mockLogger.expects('warn')
          .withArgs(sinon.match(/running as root/))
          .once();

      bridge.root(true)
          .then(function () {
            mockSdbWrapper.verify();
            mockLogger.verify();
            done();
          })
          .fail(done)

    });
  });
});
