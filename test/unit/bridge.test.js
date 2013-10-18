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
var expect = chai.expect;

var sinon = require('sinon');

var Bridge = require('../../lib/bridge');

describe('Bridge', function () {
  /**
   * NB these tests don't test whether the logger is invoked with
   * the right strings: they just test that the sdb wrapper and
   * file lister are invoked correctly, and that the responses are
   * parsed properly, returning the correct values to the callback
   */
  var logger = {
    write: function () {},
    ok: function () {},
    error: function () {},
    warn: function () {}
  };

  var sdbWrapper = {
    execute: function () {},
    shell: function () {},
    push: function () {},
    forward: function () {},
    root: function () {}
  };

  var fileLister = {
    list: function () {}
  };

  var bridge = Bridge.create({
    logger: logger,
    sdbWrapper: sdbWrapper,
    fileLister: fileLister
  });

  var mockSdbWrapper;
  var mockBridge;
  var mockLogger;
  beforeEach(function () {
    mockSdbWrapper = sinon.mock(sdbWrapper);
    mockBridge = sinon.mock(bridge);
    mockLogger = sinon.mock(logger);
  });

  afterEach(function () {
    mockSdbWrapper.restore();
    mockBridge.restore();
    mockLogger.restore();
  });

  // useful matcher aliases
  var aFunction = sinon.match.instanceOf(Function);
  var anError = sinon.match.instanceOf(Error);

  it('should create a default console logger if none is supplied', function () {
    var logger = Bridge.create({
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
      Bridge.create({
        logger: {}
      })
    };

    var expected = 'Bridge must be initialised with an sdbWrapper instance';

    expect(testConstruct).to.throw(expected);
  });

  it('should require sdbWrapper property on creation', function () {
    var testConstruct = function () {
      Bridge.create({
        logger: {},
        sdbWrapper: {}
      })
    };

    var expected = 'Bridge must be initialised with the fileLister instance';

    expect(testConstruct).to.throw(expected);
  });

  describe('fileExists()', function () {
    var remotePath = '/tmp/foo.txt';
    var cb = sinon.spy();

    it('should callback with true if file exists', function () {
      mockSdbWrapper.expects('shell')
                    .withArgs('stat ' + remotePath, aFunction)
                    .callsArgWith(1, null, '', '')
                    .once();

      bridge.fileExists(remotePath, cb);

      cb.calledWith(null, true).should.be.true;
      mockSdbWrapper.verify();
    });

    it('should callback with false if file does not exist', function () {
      mockSdbWrapper.expects('shell')
                    .withArgs('stat ' + remotePath, aFunction)
                    .callsArgWith(1, null, 'No such file or directory', '')
                    .once();

      bridge.fileExists(remotePath, cb);

      cb.calledWith(null, false).should.be.true;
      mockSdbWrapper.verify();
    });

    it('should callback with error if error occurs when invoking sdb', function () {
      mockSdbWrapper.expects('shell')
                    .withArgs('stat ' + remotePath, aFunction)
                    .callsArgWith(1, new Error())
                    .once();

      bridge.fileExists(remotePath, cb);

      cb.calledWith(sinon.match(Error)).should.be.true;
      mockSdbWrapper.verify();
    });
  });

  describe('chmod()', function () {
    var remotePath = '/tmp/somescript.sh';
    var chmodStr = '+x';
    var cb = sinon.spy();

    it('should callback with no error if chmod worked', function () {
      mockSdbWrapper.expects('shell')
                    .withArgs(
                      'chmod ' + chmodStr + ' ' + remotePath,
                      aFunction
                    )
                    .callsArgWith(1, null, '', '')
                    .once();

      bridge.chmod(remotePath, chmodStr, cb);

      cb.calledOnce.should.be.true;
      mockSdbWrapper.verify();
    });

    it('should callback with no error if chmod failed', function () {
      mockSdbWrapper.expects('shell')
                    .withArgs(
                      'chmod ' + chmodStr + ' ' + remotePath,
                      aFunction
                    )
                    .callsArgWith(1, new Error())
                    .once();

      bridge.chmod(remotePath, chmodStr, cb);

      cb.calledWith(sinon.match(Error)).should.be.true;
      mockSdbWrapper.verify();
    });
  });

  describe('listRemoteFiles()', function () {
    it('should callback with the file path passed in if it is a string', function () {
      var cb = sinon.spy()
      var filename = '/tmp/package.wgt';

      bridge.listRemoteFiles(filename, cb);

      cb.calledWith(null, [filename]).should.be.true
    });

    it('should callback with the file paths passed in if passed an array', function () {
      var cb = sinon.spy()
      var filenames = ['/tmp/package.wgt', '/tmp/package2.wgt'];

      bridge.listRemoteFiles(filenames, cb);

      cb.calledWith(null, filenames).should.be.true
    });

    it('should callback with error if ls fails on the sdb shell', function () {
      var cb = sinon.spy()
      var filespec = {pattern: '/tmp/*.wgt'};

      mockSdbWrapper.expects('shell')
                    .withArgs(
                      'ls -1 -c ' + filespec.pattern,
                      aFunction
                    )
                    .callsArgWith(1, new Error())
                    .once();

      bridge.listRemoteFiles(filespec, cb);

      cb.calledWith(sinon.match(Error)).should.be.true;
      mockSdbWrapper.verify();
    });

    it('should callback with matching files if ls successful', function () {
      var cb = sinon.spy();

      var filespec = {pattern: '/tmp/*.wgt'};
      var stdout = 'young.wgt\nold.wgt';
      var expected = ['young.wgt', 'old.wgt'];

      mockSdbWrapper.expects('shell')
                    .withArgs(
                      'ls -1 -c ' + filespec.pattern,
                      aFunction
                    )
                    .callsArgWith(1, null, stdout, '')
                    .once();

      bridge.listRemoteFiles(filespec, cb);

      cb.lastCall.args[1].should.eql(expected);
      mockSdbWrapper.verify();
    });

    it('should callback with first file in list if filter set to "latest"', function () {
      var cb = sinon.spy();

      var filespec = {pattern: '/tmp/*.wgt', filter: 'latest'};
      var stdout = 'young.wgt\nold.wgt';
      var expected = ['young.wgt'];

      mockSdbWrapper.expects('shell')
                    .withArgs(
                      'ls -1 -c ' + filespec.pattern,
                      aFunction
                    )
                    .callsArgWith(1, null, stdout, '')
                    .once();

      bridge.listRemoteFiles(filespec, cb);

      cb.lastCall.args[1].should.eql(expected);
      mockSdbWrapper.verify();
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

    it('should callback with no arguments if sdb push successful', function () {
      var cb = sinon.spy();

      mockSdbWrapper.expects('push')
                    .withArgs(
                      localFile,
                      remotePath,
                      aFunction
                    )
                    .callsArgWith(2, null, '', '')
                    .once();

      bridge.pushRaw(localFile, remotePath, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockSdbWrapper.verify();
    });

    it('should callback with error thrown by sdb push', function () {
      var cb = sinon.spy();
      var err = new Error();

      mockSdbWrapper.expects('push')
                    .withArgs(
                      localFile,
                      remotePath,
                      aFunction
                    )
                    .callsArgWith(2, err, '', '')
                    .once();

      bridge.pushRaw(localFile, remotePath, cb);

      cb.calledWith(err).should.be.true;
      mockSdbWrapper.verify();
    });

    it('should callback with error if sdb stderr indicates ' +
       'that push failed, even if exit code is good', function () {
      var cb = sinon.spy();

      mockSdbWrapper.expects('push')
                    .withArgs(
                      localFile,
                      remotePath,
                      aFunction
                    )
                    .callsArgWith(2, null, '', 'failed to copy')
                    .once();

      mockSdbWrapper.expects('push')
                    .withArgs(
                      localFile,
                      remotePath,
                      aFunction
                    )
                    .callsArgWith(2, null, '', 'cannot stat')
                    .once();

      bridge.pushRaw(localFile, remotePath, cb);
      cb.calledWith(anError).should.be.true;
      cb.reset();

      bridge.pushRaw(localFile, remotePath, cb);
      cb.calledWith(anError).should.be.true;

      mockSdbWrapper.verify();
    });
  });

  describe('pushOne()', function () {
    var localFile = 'build/package.wgt';
    var remoteDir = '/home/developer/';
    var expectedRemotePath = '/home/developer/package.wgt';

    it('should callback with no arguments if overwrite false, ' +
       'no chmod, file doesn\'t exist and push succeeds', function () {
      var overwrite = false;
      var chmod = null;
      var cb = sinon.spy();

      mockBridge.expects('getDestination')
                .withArgs(localFile, remoteDir)
                .returns(expectedRemotePath)
                .once();
      mockBridge.expects('fileExists')
                .withArgs(expectedRemotePath, aFunction)
                .callsArgWith(1, null, false)
                .once();
      mockBridge.expects('pushRaw')
                .withArgs(
                  localFile,
                  expectedRemotePath,
                  cb
                )
                .callsArg(2)
                .once();

      bridge.pushOne(localFile, remoteDir, overwrite, chmod, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockBridge.verify();
    });

    it('should log warning and invoke callback if overwrite false, ' +
       'no chmod, and file exists', function () {
      var overwrite = false;
      var chmod = null;
      var cb = sinon.spy();

      var loggerMock = sinon.mock(logger);
      loggerMock.expects('warn').once();

      mockBridge.expects('getDestination')
                .withArgs(localFile, remoteDir)
                .returns(expectedRemotePath)
                .once();
      mockBridge.expects('fileExists')
                .withArgs(expectedRemotePath, aFunction)
                .callsArgWith(1, null, true)
                .once();

      bridge.pushOne(localFile, remoteDir, overwrite, chmod, cb);

      // cb invoked once with no arguments
      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);

      loggerMock.verify();
      mockBridge.verify();
    });

    it('should callback with error if overwrite true, no chmod, ' +
       'but push fails', function () {
      var overwrite = true;
      var chmod = null;
      var cb = sinon.spy();

      mockBridge.expects('getDestination')
                .withArgs(localFile, remoteDir)
                .returns(expectedRemotePath)
                .once();
      mockBridge.expects('pushRaw')
                .withArgs(
                  localFile,
                  expectedRemotePath,
                  cb
                )
                .callsArgWith(2, new Error())
                .once();

      bridge.pushOne(localFile, remoteDir, overwrite, chmod, cb);

      // cb invoked once with error
      cb.calledOnce.should.be.true;
      cb.calledWith(anError).should.be.true;

      mockBridge.verify();
    });

    it('should callback with error if overwrite false and the fileExists() ' +
       'check throws an error', function () {
      var overwrite = false;
      var chmod = null;
      var cb = sinon.spy();

      mockBridge.expects('getDestination')
                .withArgs(localFile, remoteDir)
                .returns(expectedRemotePath)
                .once();
      mockBridge.expects('fileExists')
                .withArgs(expectedRemotePath, aFunction)
                .callsArgWith(1, new Error())
                .once();

      bridge.pushOne(localFile, remoteDir, overwrite, chmod, cb);

      // cb invoked once with error
      cb.calledOnce.should.be.true;
      cb.calledWith(anError).should.be.true;

      mockBridge.verify();
    });

    it('should run chmod on pushed file if chmod argument supplied', function () {
      var overwrite = true;
      var chmod = '+x';
      var cb = sinon.spy();

      mockBridge.expects('getDestination')
                .withArgs(localFile, remoteDir)
                .returns(expectedRemotePath)
                .once();
      mockBridge.expects('pushRaw')
                .withArgs(
                  localFile,
                  expectedRemotePath,
                  aFunction
                )
                .callsArg(2)
                .once();
      mockBridge.expects('chmod')
                .withArgs(expectedRemotePath, chmod, cb)
                .callsArg(2)
                .once();

      bridge.pushOne(localFile, remoteDir, overwrite, chmod, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockBridge.verify();
    });
  });

  describe('push()', function () {
    it('should callback with error if local files can\'t be listed', function () {
      var stub = sinon.stub(fileLister, 'list');
      var err = new Error();
      stub.callsArgWith(1, err);

      var cb = sinon.spy();

      bridge.push('build/*.wgt', '/home/developer', true, '+x', cb);

      cb.calledWith(err).should.be.true;
      stub.restore();
    });

    it('should callback with an error if any push fails', function () {
      // stub out the file lister to return two file names
      var stub = sinon.stub(fileLister, 'list');
      var localFiles = ['build/one.wgt', 'build/two.wgt'];
      stub.callsArgWith(1, null, localFiles);

      // mock out the pushes so that the second push fails
      var err = new Error();

      mockBridge.expects('pushOne')
                .withArgs(
                  'build/one.wgt',
                  '/home/developer',
                  true,
                  '+x',
                  aFunction
                )
                .callsArg(4)
                .once();

      // second push fails
      mockBridge.expects('pushOne')
                .withArgs(
                  'build/two.wgt',
                  '/home/developer',
                  true,
                  '+x',
                  aFunction
                )
                .callsArgWith(4, err)
                .once();

      // call under test
      var cb = sinon.spy();

      bridge.push('build/*.wgt', '/home/developer', true, '+x', cb);

      // check expectations
      cb.calledWith(err).should.be.true;
      mockBridge.verify();
      stub.restore();
    });

    it('should callback with no arguments if all local files are pushed', function () {
      // stub out the file lister to return two file names
      var stub = sinon.stub(fileLister, 'list');
      var localFiles = ['build/one.wgt', 'build/two.wgt'];
      stub.callsArgWith(1, null, localFiles);

      // mock out the pushes so that the second push fails
      var err = new Error();

      mockBridge.expects('pushOne')
                .withArgs(
                  'build/one.wgt',
                  '/home/developer',
                  true,
                  '+x',
                  aFunction
                )
                .callsArg(4)
                .once();

      // second push fails
      mockBridge.expects('pushOne')
                .withArgs(
                  'build/two.wgt',
                  '/home/developer',
                  true,
                  '+x',
                  aFunction
                )
                .callsArgWith(4)
                .once();

      // call under test
      var cb = sinon.spy();

      bridge.push('build/*.wgt', '/home/developer', true, '+x', cb);

      // check expectations
      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockBridge.verify();
      stub.restore();
    });
  });

  describe('runScript()', function () {
    it('should callback with error if script fails on device', function () {
      var cmd = '/home/developer/dumpstorage.sh';

      var cb = sinon.spy();

      var err = new Error();

      mockSdbWrapper.expects('shell')
                    .withArgs(
                      bridge.scriptInterpreterPath + ' ' + cmd,
                      aFunction
                    )
                    .callsArgWith(1, err)
                    .once();

      bridge.runScript(cmd, cb);

      cb.calledWith(err).should.be.true;
      mockSdbWrapper.verify();
    });

    it('should callback with no arguments if script succeeds on device', function () {
      var cmd = '/home/developer/dumpstorage.sh';

      var cb = sinon.spy();

      var err = new Error();

      mockSdbWrapper.expects('shell')
                    .withArgs(
                      bridge.scriptInterpreterPath + ' ' + cmd,
                      aFunction
                    )
                    .callsArgWith(1)
                    .once();

      bridge.runScript(cmd, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockSdbWrapper.verify();
    });

    it('should add arguments to the command if supplied', function () {
      var args = ['arg1', 'arg2', 'arg3'];
      var cmd = '/home/developer/dumpstorage.sh';
      var expected = '/home/developer/dumpstorage.sh arg1 arg2 arg3';

      var cb = sinon.spy();

      var err = new Error();

      mockSdbWrapper.expects('shell')
                    .withArgs(
                      bridge.scriptInterpreterPath + ' ' + expected,
                      aFunction
                    )
                    .callsArgWith(1)
                    .once();

      bridge.runScript(cmd, args, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockSdbWrapper.verify();
    });
  });

  describe('runTizenAppScript()', function () {
    it('should callback with error if tizenAppScriptPath ' +
       'property not set', function () {
      var bridge = Bridge.create({
        logger: logger,
        fileLister: fileLister,
        sdbWrapper: sdbWrapper
      });

      var cb = sinon.spy();

      bridge.runTizenAppScript('start', [], cb);

      cb.calledWith(anError).should.be.true;
    });

    it('should run tizen-app.sh on device with specified command', function () {
      var bridge = Bridge.create({
        logger: logger,
        fileLister: fileLister,
        sdbWrapper: sdbWrapper,
        tizenAppScriptPath: '/home/developer/tizen-app.sh'
      });

      var cb = sinon.spy();

      var err = null;
      var stdout = '';
      var stderr = ''

      mockSdbWrapper.expects('shell')
                    .withArgs(
                      '/home/developer/tizen-app.sh start id1 uri2',
                      aFunction
                    )
                    .callsArgWith(1, err, stdout, stderr)
                    .once();

      bridge.runTizenAppScript('start', ['id1', 'uri2'], cb);

      cb.calledOnce.should.be.true;
      cb.calledWith(err, stdout, stdout).should.be.true;
      cb.reset();

      // test that no args also works
      mockSdbWrapper.expects('shell')
                    .withArgs(
                      '/home/developer/tizen-app.sh start',
                      aFunction
                    )
                    .callsArgWith(1, err, stdout, stderr)
                    .once();

      bridge.runTizenAppScript('start', [], cb);

      cb.calledOnce.should.be.true;
      cb.calledWith(err, stdout, stdout).should.be.true;
      cb.reset();

      // test that errors are propagated correctly
      err = new Error();

      mockSdbWrapper.expects('shell')
                    .withArgs(
                      '/home/developer/tizen-app.sh start',
                      aFunction
                    )
                    .callsArgWith(1, err, stdout, stderr)
                    .once();

      bridge.runTizenAppScript('start', [], cb);

      cb.calledOnce.should.be.true;
      cb.calledWith(err, stdout, stdout).should.be.true;
      cb.reset();

      mockSdbWrapper.verify();
    });

    it('should callback with error if missing file/dir', function () {
      var bridge = Bridge.create({
        logger: logger,
        fileLister: fileLister,
        sdbWrapper: sdbWrapper,
        tizenAppScriptPath: '/home/developer/tizen-app.sh'
      });

      var cb = sinon.spy();

      // no error but stdout reports missing directory; this should be
      // converted to an error by the bridge
      var err = null;
      var stdout = 'No such file or directory';
      var stderr = ''

      mockSdbWrapper.expects('shell')
                    .withArgs(
                      '/home/developer/tizen-app.sh start id1 uri2',
                      aFunction
                    )
                    .callsArgWith(1, err, stdout, stderr)
                    .once();

      bridge.runTizenAppScript('start', ['id1', 'uri2'], cb);

      cb.calledOnce.should.be.true;
      var cbArgs = cb.lastCall.args;

      cbArgs[0].should.be.instanceof(Error);
      cbArgs[1].should.equal(stdout);
      cbArgs[2].should.equal(stderr);

      mockSdbWrapper.verify();
    });
  });

  describe('installOne()', function () {
    var remoteFile = '/home/developer/app.wgt';

    it('should callback with error if wrt-installer fails', function () {
      var cb = sinon.spy();

      mockBridge.expects('runTizenAppScript')
                .withArgs('install', [remoteFile])
                .callsArgWith(2, new Error())
                .once();

      bridge.installOne(remoteFile, cb);

      cb.calledWith(anError).should.be.true;
      cb.reset();

      // case where wrt-installer fails but returns valid exit code
      mockBridge.expects('runTizenAppScript')
                .withArgs('install', [remoteFile])
                .callsArgWith(2, null, 'key[end] val[fail]', '')
                .once();

      bridge.installOne(remoteFile, cb);

      cb.calledWith(anError).should.be.true;

      mockBridge.verify();
    });

    it('should callback with no arguments if wrt-installer succeeds', function () {
      var cb = sinon.spy();

      mockBridge.expects('runTizenAppScript')
                .withArgs('install', [remoteFile])
                .callsArgWith(2, null, '', '')
                .once();

      bridge.installOne(remoteFile, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockBridge.verify();
    });
  });

  describe('install()', function () {
    var remoteFilesSpec = {pattern: '/home/developer/*.wgt', filter: 'latest'};
    var remoteFileNewest = '/home/developer/newest.wgt';
    var remoteFileOldest = '/home/developer/oldest.wgt';
    var remoteFiles = [remoteFileNewest, remoteFileOldest];

    it('should callback with error if the remote file listing fails', function () {
      var cb = sinon.spy();

      var err = new Error();

      mockBridge.expects('listRemoteFiles')
                .withArgs(remoteFilesSpec, aFunction)
                .callsArgWith(1, err)
                .once();

      bridge.install(remoteFilesSpec, cb);

      cb.calledWith(err).should.be.true;
      mockBridge.verify();
    });

    it('should callback with error if any single install fails', function () {
      var cb = sinon.spy();

      var err = new Error();

      mockBridge.expects('listRemoteFiles')
                .withArgs(remoteFilesSpec, aFunction)
                .callsArgWith(1, null, remoteFiles)
                .once();

      mockBridge.expects('installOne')
                .withArgs(remoteFileNewest, aFunction)
                .callsArg(1)
                .once();

      mockBridge.expects('installOne')
                .withArgs(remoteFileOldest, aFunction)
                .callsArgWith(1, err)
                .once();

      bridge.install(remoteFilesSpec, cb);

      cb.calledWith(err).should.be.true;
      mockBridge.verify();
    });

    it('should display warning message if no files match', function () {
      var cb = sinon.spy();

      mockBridge.expects('listRemoteFiles')
                .withArgs(remoteFilesSpec, aFunction)
                .callsArgWith(1, null, [])
                .once();

      mockLogger.expects('warn').withArgs('no packages to install');

      bridge.install(remoteFilesSpec, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockBridge.verify();
      mockLogger.verify();
    });

    it('should callback with no arguments if all installs succeed', function () {
      var cb = sinon.spy();

      mockBridge.expects('listRemoteFiles')
                .withArgs(remoteFilesSpec, aFunction)
                .callsArgWith(1, null, remoteFiles)
                .once();

      mockBridge.expects('installOne')
                .withArgs(remoteFileNewest, aFunction)
                .callsArg(1)
                .once();

      mockBridge.expects('installOne')
                .withArgs(remoteFileOldest, aFunction)
                .callsArg(1)
                .once();

      bridge.install(remoteFilesSpec, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockBridge.verify();
    });
  });

  describe('uninstall()', function () {
    var appId = 'app1';

    it('should callback with error if tizen-app.sh fails ' +
       'and stopOnFailure is true', function () {
      var stopOnFailure = true;
      var cb = sinon.spy();

      // tizen-app.sh throws an error
      var err = new Error();

      mockBridge.expects('runTizenAppScript')
                .withArgs('uninstall', [appId], aFunction)
                .callsArgWith(2, err)
                .once();

      bridge.uninstall(appId, stopOnFailure, cb);

      cb.calledWith(anError).should.be.true;

      // tizen-app.sh stdout says "not installed"
      mockBridge.expects('runTizenAppScript')
                .withArgs('uninstall', [appId], aFunction)
                .callsArgWith(2, null, 'not installed', '')
                .once();

      bridge.uninstall(appId, stopOnFailure, cb);

      cb.calledWith(anError).should.be.true;

      // tizen-app.sh stdout says "failed"
      mockBridge.expects('runTizenAppScript')
                .withArgs('uninstall', [appId], aFunction)
                .callsArgWith(2, null, 'failed', '')
                .once();

      bridge.uninstall(appId, stopOnFailure, cb);

      cb.calledWith(anError).should.be.true;
      mockBridge.verify();
    });

    it('should show warning and callback if tizen-app.sh fails ' +
       'but stopOnFailure is false', function () {
      var stopOnFailure = false;
      var cb = sinon.spy();

      mockBridge.expects('runTizenAppScript')
                .withArgs('uninstall', [appId], aFunction)
                .callsArgWith(2, new Error())
                .once();

      mockLogger.expects('warn')
                .withArgs('could not uninstall package; continuing anyway')
                .once();

      bridge.uninstall(appId, stopOnFailure, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockBridge.verify();
      mockLogger.verify();
    });

    it('should callback with no args if tizen-app.sh succeeds', function () {
      var stopOnFailure = true;
      var cb = sinon.spy();

      mockBridge.expects('runTizenAppScript')
                .withArgs('uninstall', [appId], aFunction)
                .callsArgWith(2, null, '', '')
                .once();

      // this is to differentiate between success and the "fails
      // but stopOnFailure set to false, so continues anyway" condition
      mockLogger.expects('ok').once();

      bridge.uninstall(appId, stopOnFailure, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockBridge.verify();
      mockLogger.verify();
    });
  });

  describe('launch()', function () {
    var subcommand = 'start';
    var appUri = 'http://bogus.url/app1';

    it('should callback with an error if tizen-app.sh fails ' +
       'and stopOnFailure is true', function () {
      var stopOnFailure = true;
      var cb = sinon.spy();

      // tizen-app.sh has a bad exit code
      mockBridge.expects('runTizenAppScript')
                .withArgs(subcommand, [appUri], aFunction)
                .callsArgWith(2, new Error(), '', '')
                .once();

      bridge.launch(subcommand, appUri, stopOnFailure, cb);

      cb.calledWith(anError).should.be.true;
      cb.reset();

      // tizen-app.sh stdout says "does not exist"
      mockBridge.expects('runTizenAppScript')
                .withArgs(subcommand, [appUri], aFunction)
                .callsArgWith(2, null, 'does not exist', '')
                .once();

      bridge.launch(subcommand, appUri, stopOnFailure, cb);

      cb.calledWith(anError).should.be.true;
      cb.reset();

      // tizen-app.sh stdout says "running"
      mockBridge.expects('runTizenAppScript')
                .withArgs(subcommand, [appUri], aFunction)
                .callsArgWith(2, null, 'running', '')
                .once();

      bridge.launch(subcommand, appUri, stopOnFailure, cb);

      cb.calledWith(anError).should.be.true;
      cb.reset();

      // tizen-app.sh stdout says "failed"
      mockBridge.expects('runTizenAppScript')
                .withArgs(subcommand, [appUri], aFunction)
                .callsArgWith(2, null, 'failed', '')
                .once();

      bridge.launch(subcommand, appUri, stopOnFailure, cb);

      cb.calledWith(anError).should.be.true;
      cb.reset();

      mockBridge.verify();
      mockLogger.verify();
    });

    it('should callback with no args and show warning if tizen-app.sh fails ' +
       'and stopOnFailure is false', function () {
      var stopOnFailure = false;
      var cb = sinon.spy();

      // tizen-app.sh has a bad exit code
      mockBridge.expects('runTizenAppScript')
                .withArgs(subcommand, [appUri], aFunction)
                .callsArgWith(2, new Error(), '', '')
                .once();

      // to differentiate between fail with warning and success
      mockLogger.expects('warn').once();

      bridge.launch(subcommand, appUri, stopOnFailure, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockBridge.verify();
      mockLogger.verify();
    });

    it('should callback with stdout if tizen-app.sh succeeds', function () {
      var stopOnFailure = true;
      var cb = sinon.spy();

      var stdout = 'PORT 24040';
      var stderr = '';

      // tizen-app.sh has a bad exit code
      mockBridge.expects('runTizenAppScript')
                .withArgs(subcommand, [appUri], aFunction)
                .callsArgWith(2, null, stdout, stderr)
                .once();

      // to differentiate between fail with warning and success
      mockLogger.expects('ok').once();

      bridge.launch(subcommand, appUri, stopOnFailure, cb);

      var cbArgs = cb.lastCall.args;

      expect(cbArgs[0]).to.be.null;
      cbArgs[1].should.equal(stdout);
      mockBridge.verify();
      mockLogger.verify();
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

    beforeEach(function () {
      bridge.browserWrapper = null;
    });

    it('should callback with an error if browserWrapper not set', function () {
      var cb = sinon.spy();

      mockBridge.expects('getDebugUrl').returns(debugUrl).once();

      bridge.runBrowser(browserCmd, 9000, cb);

      cb.calledWith(anError).should.be.true;
      mockBridge.verify();
    });

    it('should callback with an error if browserWrapper fails', function () {
      bridge.browserWrapper = sinon.stub();

      var cb = sinon.spy();
      var err = new Error();

      mockBridge.expects('getDebugUrl').returns(debugUrl).once();
      bridge.browserWrapper.withArgs(expectedCmd, aFunction)
                           .callsArgWith(1, err);

      bridge.runBrowser(browserCmd, 9000, cb);

      cb.lastCall.args[0].should.equal(err);
      mockBridge.verify();
    });

    it('should callback with no args if browserWrapper succeeds', function () {
      bridge.browserWrapper = sinon.stub();

      var cb = sinon.spy();

      mockBridge.expects('getDebugUrl').returns(debugUrl).once();

      bridge.browserWrapper.withArgs(expectedCmd, aFunction)
                           .callsArgWith(1, null, '', '');

      bridge.runBrowser(browserCmd, 9000, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockBridge.verify();
    });
  });

  describe('portForward()', function () {
    var localPort = 8888;
    var remotePort = 9000;
    var debugUrl = 'http://localhost:8888/';

    it('should callback with error if sdb forward fails', function () {
      var cb = sinon.spy();
      var err = new Error();

      mockSdbWrapper.expects('forward')
                    .withArgs(localPort, remotePort, aFunction)
                    .callsArgWith(2, err)
                    .once();

      bridge.portForward(localPort, remotePort, cb);

      cb.calledWith(err).should.be.true;
      mockSdbWrapper.verify();
    });

    it('should callback with no args if sdb forward succeeds', function () {
      var cb = sinon.spy();
      var err = new Error();

      mockBridge.expects('getDebugUrl')
                .withArgs(localPort)
                .returns(debugUrl)
                .once();

      mockSdbWrapper.expects('forward')
                    .withArgs(localPort, remotePort, aFunction)
                    .callsArgWith(2, null, '', '')
                    .once();

      mockLogger.expects('ok')
                .withArgs('app is ready for debugging at \n' + debugUrl)
                .once;

      bridge.portForward(localPort, remotePort, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockBridge.verify();
      mockSdbWrapper.verify();
      mockLogger.verify();
    });
  });

  describe('root()', function () {
    it('should callback with an error if sdb root fails', function () {
      var cb = sinon.spy();
      var err = new Error();

      mockSdbWrapper.expects('root')
                    .withArgs(true, aFunction)
                    .callsArgWith(1, err)
                    .once();

      bridge.root(true, cb);

      cb.calledWith(err).should.be.true;
      mockSdbWrapper.verify();
    });

    it('should log message that root is off if root turned off', function () {
      var cb = sinon.spy();

      mockSdbWrapper.expects('root')
                    .withArgs(false, aFunction)
                    .callsArgWith(1, null, '', '')
                    .once();

      mockLogger.expects('ok')
                .withArgs(sinon.match(/no longer running as root/))
                .once();

      bridge.root(false, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockSdbWrapper.verify();
      mockLogger.verify();
    });

    it('should log message that root is on if root turned on', function () {
      var cb = sinon.spy();

      mockSdbWrapper.expects('root')
                    .withArgs(true, aFunction)
                    .callsArgWith(1, null, '', '')
                    .once();

      mockLogger.expects('warn')
                .withArgs(sinon.match(/running as root/))
                .once();

      bridge.root(true, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockSdbWrapper.verify();
      mockLogger.verify();
    });
  });
});
