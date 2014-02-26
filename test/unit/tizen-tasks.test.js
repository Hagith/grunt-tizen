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

// test generated tasks
var chai = require('chai');
chai.should();
chai.use(require('chai-as-promised'));
require('mocha-as-promised')();

var expect = chai.expect,
    sinon = require('sinon'),
    Q = require('q');

var tasksMaker = require('../../lib/tasks-maker');

describe('constructor', function () {

  it('should fail if no bridge is supplied', function () {
    return tasksMaker({
      tizenConfig: {}
    }).should.be.rejectedWith(Error);
  });

  it('should throw an error if no tizenConfig is supplied', function () {
    return tasksMaker({
      bridge: {}
    }).should.be.rejectedWith(Error);
  });

  it('should return an object with tizenPrepareTask and ' +
      'tizenTask tasks', function () {
    var tasks = tasksMaker({
      bridge: {},
      tizenConfig: {}
    });

    tasks.should.have.property('tizenPrepareTask');
    tasks.should.have.property('tizenTask');
  });

});

describe('tizenPrepareTask', function () {
  var bridge = {
    tizenAppScriptLocal: 'tizen-app.sh',
    tizenAppScriptDir: '/tmp'
  };

  it('should fail if push fails', function () {
    bridge.push = sinon.stub().returns(Q.reject(new Error('push failed')));

    var tasks = tasksMaker({
      bridge: bridge,
      tizenConfig: {}
    });

    return tasks.tizenPrepareTask().should.be.rejectedWith(Error);
  });

  it('should callback with 0 args if push succeeds', function () {
    bridge.push = sinon.stub().returns(Q.resolve());

    var tasks = tasksMaker({
      bridge: bridge,
      tizenConfig: {}
    });

    return tasks.tizenPrepareTask().should.be.fulfilled;
  });
});

describe('tizenTask', function () {
  var tasks = tasksMaker({
    bridge: {},
    tizenConfig: {}
  });

  it('should fail if no action is specified', function () {
    return tasks.tizenTask({action: null})
        .should.be.rejectedWith(Error);
  });

  it('should fail if invalid action is specified', function () {
    return tasks.tizenTask({action: 'blibbyblobbyblobgob'})
        .should.be.rejectedWith(Error);
  });
});

describe('tizenTask push', function () {

  var bridge = {
    push: function (localFiles, remoteDir, overwrite, chmod) {}
  };

  var tasks = tasksMaker({
    bridge: bridge,
    tizenConfig: {}
  });

  var localFiles = 'tizen-app.sh';
  var remoteDir = '/tmp';

  it('should fail if localFiles is not defined', function () {
    var data = {
      action: 'push'
    };

    return tasks.tizenTask(data).should.be.rejectedWith(Error);
  });

  it('should fail if remoteDir is not defined', function () {
    var data = {
      action: 'push',
      localFiles: 'tizen-app.sh'
    };

    return tasks.tizenTask(data)
        .should.be.rejectedWith(Error, /needs a remoteDir property/);
  });

  it('should fail if push fails on the bridge', function () {
    var data = {
      action: 'push',
      localFiles: localFiles,
      remoteDir: remoteDir,
      overwrite: false,
      chmod: '+x'
    };

    var mockBridge = sinon.mock(bridge);

    mockBridge.expects('push')
        .withArgs(localFiles, remoteDir, false, '+x')
        .returns(Q.reject(new Error()))
        .once();

    var result = tasks.tizenTask(data);

    mockBridge.verify();
    return result.should.be.rejectedWith(Error);
  });

  it('should default to overwrite=true and chmod=null', function () {
    var data = {
      action: 'push',
      localFiles: localFiles,
      remoteDir: remoteDir
    };

    var mockBridge = sinon.mock(bridge);

    mockBridge.expects('push')
        .withArgs(localFiles, remoteDir, true, null)
        .returns(Q.resolve())
        .once();

    var result = tasks.tizenTask(data);

    mockBridge.verify();
    return result.should.be.fulfilled;
  });

  it('should use overwrite and chmod passed in data', function () {
    var data = {
      action: 'push',
      localFiles: localFiles,
      remoteDir: remoteDir,
      overwrite: false,
      chmod: '+x'
    };

    var mockBridge = sinon.mock(bridge);

    mockBridge.expects('push')
        .withArgs(localFiles, remoteDir, false, '+x')
        .returns(Q.resolve())
        .once();

    var result = tasks.tizenTask(data);

    mockBridge.verify();
    return result.should.be.fulfilled;
  });

});

describe('tizenTask install', function () {

  var bridge = {
    install: function () {},
    root: function () {}
  };

  var tasks = tasksMaker({
    bridge: bridge,
    tizenConfig: {}
  });

  var remoteFiles = '/tmp/package.wgt';

  it('should fail if remoteFiles not specified', function (done) {
    var data = {
      action: 'install'
    };

    sinon.stub(bridge, 'root').returns(Q.resolve());

    var result = tasks.tizenTask(data);

    bridge.root.restore();
    return result.should.be.rejectedWith(Error);
  });

  it('should fail if bridge.install fails', function (done) {
    var data = {
      action: 'install',
      remoteFiles: remoteFiles
    };

    sinon.stub(bridge, 'root').returns(Q.resolve());
    sinon.stub(bridge, 'install').returns(Q.reject(new Error()));

    tasks.tizenTask(data)
        .then(function () {
          done(new Error('this should fail'));
        })
        .fail(function () {
          bridge.install.restore();
          bridge.root.restore();
          done();
        });
  });

  it('should resolve if bridge.install succeeds', function (done) {
    var data = {
      action: 'install',
      remoteFiles: remoteFiles
    };

    sinon.stub(bridge, 'root').returns(Q.resolve());
    sinon.stub(bridge, 'install').returns(Q.resolve());

    tasks.tizenTask(data)
        .then(function () {
          bridge.install.restore();
          bridge.root.restore();
          done();
        })
        .fail(done);
  });

});

describe('tizenTask uninstall', function () {
  var tizenConfig = {
    getMeta: function () {
    }
  };

  var bridge = {
    uninstall: function (packageName, stopOnFailure) {}
  };

  var tasks = tasksMaker({
    bridge: bridge,
    tizenConfig: tizenConfig
  });

  var expectedPackageName = 'somePackageName';
  var meta = { packageName: expectedPackageName };

  it('should fail if config.xml metadata cannot be retrieved', function (done) {
    var data = {
      action: 'uninstall'
    };

    sinon.stub(tizenConfig, 'getMeta').returns(Q.reject(new Error()));

    tasks.tizenTask(data)
        .then(function () {
          done(new Error('this should fail'));
        })
        .fail(function () {
          tizenConfig.getMeta.restore();
          done();
        });
  });

  it('should default to stopOnFailure=false', function (done) {
    var expectedStop = false;

    var data = {
      action: 'uninstall'
    };

    sinon.stub(tizenConfig, 'getMeta').returns(Q.resolve(meta));

    var mockBridge = sinon.mock(bridge);
    mockBridge.expects('uninstall')
        .withArgs(expectedPackageName, expectedStop)
        .returns(Q.resolve())
        .once();

    tasks.tizenTask(data)
        .then(function (err) {
          tizenConfig.getMeta.restore();
          mockBridge.verify();
          done();
        })
        .fail(done);
  });

  it('should fail if bridge.uninstall fails', function (done) {
    var expectedStop = true;
    var data = {
      action: 'uninstall',
      stopOnFailure: expectedStop
    };

    sinon.stub(tizenConfig, 'getMeta').returns(Q.resolve(meta));

    var mockBridge = sinon.mock(bridge);
    mockBridge.expects('uninstall')
        .withArgs(expectedPackageName, expectedStop)
        .returns(Q.reject(new Error()))
        .once();

    tasks.tizenTask(data)
        .then(function () {
          done(new Error('this should fail'))
        })
        .fail(function () {
          tizenConfig.getMeta.restore();
          mockBridge.verify();
          done();
        });
  });

  it('should resolve if bridge.uninstall succeeds', function (done) {
    var data = {
      action: 'uninstall'
    };

    sinon.stub(tizenConfig, 'getMeta').returns(Q.resolve(meta));

    var mockBridge = sinon.mock(bridge);
    mockBridge.expects('uninstall')
        .withArgs(expectedPackageName, false)
        .returns(Q.resolve())
        .once();

    tasks.tizenTask(data)
        .then(function () {
          tizenConfig.getMeta.restore();
          mockBridge.verify();
          done();
        })
        .fail(done);
  });
});

describe('tizenTask script', function () {
  var tizenConfig = {
    getMeta: function () {
    }
  };

  var bridge = {
    runScript: function () {}
  };

  var tasks = tasksMaker({
    bridge: bridge,
    tizenConfig: tizenConfig
  });

  var meta = {
    id: 'someid',
    uri: 'someuri',
    packageName: 'somepackagename'
  };

  var remoteScript = '/tmp/tizen-app.sh';

  it('should fail if remoteScript is not specified', function (done) {
    tasks.tizenTask({action: 'script'})
        .then(function () {
          done(new Error('this should fail'))
        })
        .fail(function (err) {
          err.message.should.match(/needs a remoteScript property/);
          done();
        });
  });

  it('should fail if tizenConfig.getMeta fails', function (done) {
    var data = {
      action: 'script',
      remoteScript: remoteScript
    };

    sinon.stub(tizenConfig, 'getMeta').returns(Q.reject(new Error()));

    tasks.tizenTask(data)
        .then()
        .fail(function () {
          tizenConfig.getMeta.restore();
          done();
        });
  });

  it('should fail if bridge.runScript fails', function (done) {
    var data = {
      action: 'script',
      remoteScript: remoteScript
    };

    sinon.stub(tizenConfig, 'getMeta').returns(Q.resolve(meta));
    sinon.stub(bridge, 'runScript')
        .withArgs(remoteScript, [meta.packageName, meta.id])
        .returns(Q.reject(new Error()));

    tasks.tizenTask(data)
        .then(function () {
          done(new Error('this should fail'))
        })
        .fail(function () {
          tizenConfig.getMeta.restore();
          bridge.runScript.restore();
          done();
        });
  });

  it('should pass data.args to runScript as arguments', function (done) {
    var data = {
      action: 'script',
      remoteScript: remoteScript,
      args: ['foo', 'bar']
    };

    var expectedArgs = [meta.packageName, meta.id, 'foo', 'bar'];

    sinon.stub(tizenConfig, 'getMeta').returns(Q.resolve(meta));

    var mockBridge = sinon.mock(bridge);
    mockBridge.expects('runScript')
        .withArgs(remoteScript, expectedArgs)
        .returns(Q.resolve())
        .once();

    tasks.tizenTask(data)
        .then(function (err) {
          tizenConfig.getMeta.restore();
          mockBridge.verify();
          done();
        })
        .fail(done);
  });
});

describe('tizenTask launch', function () {
  var tizenConfig = {
    getMeta: function () {
    }
  };

  var bridge = {
    launch: function (subcommand, appUri, stopOnFailure) {},
    portForward: function (localPort, remotePort) {},
    runBrowser: function (browserCmd, localPort) {}
  };

  var tasks = tasksMaker({
    bridge: bridge,
    tizenConfig: tizenConfig
  });

  var meta = {
    id: 'someid',
    uri: 'someuri'
  };

  it('should fail if tizenConfig.getMeta fails', function (done) {
    sinon.stub(tizenConfig, 'getMeta').returns(Q.reject(new Error()));

    tasks.tizenTask({action: 'start'})
        .then(function () {
          done(new Error('this should fail'));
        })
        .fail(function () {
          tizenConfig.getMeta.restore();
          done();
        });
  });

  it('should pass subcommand and stopOnFailure to bridge.launch', function (done) {
    sinon.stub(tizenConfig, 'getMeta').returns(Q.resolve(meta));

    var stopOnFailure = true;
    var action = 'start';
    var data = {action: action, stopOnFailure: stopOnFailure};

    var mockBridge = sinon.mock(bridge);
    mockBridge.expects('launch')
        .withArgs(action, meta.id, stopOnFailure)
        .returns(Q.resolve())
        .once();

    tasks.tizenTask(data)
        .then(function () {
          mockBridge.verify();
          tizenConfig.getMeta.restore();
          done();
        })
        .fail(done);
  });

  it('should fail if bridge.launch fails', function (done) {
    sinon.stub(tizenConfig, 'getMeta').returns(Q.resolve(meta));

    var stopOnFailure = true;
    var action = 'start';
    var data = {action: action, stopOnFailure: stopOnFailure};

    var mockBridge = sinon.mock(bridge);
    mockBridge.expects('launch')
        .withArgs(action, meta.id, stopOnFailure)
        .returns(Q.reject(new Error()))
        .once();

    tasks.tizenTask(data)
        .then(function () {
          done(new Error('this should fail'));
        })
        .fail(function () {
          mockBridge.verify();
          tizenConfig.getMeta.restore();
          done();
        });
  });

  it('should continue if bridge.launch succeeds', function (done) {
    sinon.stub(tizenConfig, 'getMeta').returns(Q.resolve(meta));

    var stopOnFailure = false;
    var action = 'start';
    var data = {action: action, stopOnFailure: stopOnFailure};

    var mockBridge = sinon.mock(bridge);
    mockBridge.expects('launch')
        .withArgs(action, meta.id, stopOnFailure)
        .returns(Q.resolve())
        .once();

    tasks.tizenTask(data)
        .then(function () {
          mockBridge.verify();
          tizenConfig.getMeta.restore();
          done();
        })
        .fail(done);
  });

  it('should fail if subcommand=debug but bridge.launch fails', function (done) {
    sinon.stub(tizenConfig, 'getMeta').returns(Q.resolve(meta));

    var stopOnFailure = false;
    var action = 'debug';
    var data = {action: action, stopOnFailure: stopOnFailure};

    var mockBridge = sinon.mock(bridge);

    // bridge.launch fails for debug
    mockBridge.expects('launch')
        .withArgs(action, meta.id, stopOnFailure)
        .returns(Q.reject(new Error()))
        .once();

    tasks.tizenTask(data)
        .then(function () {
          done(new Error('this should fail'));
        })
        .fail(function () {
          mockBridge.verify();
          tizenConfig.getMeta.restore();
          done();
        });
  });

  it('should fail if subcommand=debug but no remote port', function (done) {
    sinon.stub(tizenConfig, 'getMeta').returns(Q.resolve(meta));

    var stopOnFailure = false;
    var action = 'debug';
    var data = {action: action, stopOnFailure: stopOnFailure};

    var mockBridge = sinon.mock(bridge);

    // bridge.launch returns no PORT
    mockBridge.expects('launch')
        .withArgs(action, meta.id, stopOnFailure)
        .returns(Q.resolve('-------GARBAGE-------'))
        .once();

    tasks.tizenTask(data)
        .then(function () {
          done(new Error('this should fail'));
        })
        .fail(function (error) {
          mockBridge.verify();
          tizenConfig.getMeta.restore();
          error.message.should.match(/no remote port available for debugging/);
          done();
        });
  });

  it('should fail if remote port but port forwarding fails', function (done) {
    sinon.stub(tizenConfig, 'getMeta').returns(Q.resolve(meta));

    var stopOnFailure = false;
    var action = 'debug';
    var data = {action: action, stopOnFailure: stopOnFailure, localPort: 9090};

    var mockBridge = sinon.mock(bridge);

    // bridge.launch returns PORT
    mockBridge.expects('launch')
        .withArgs(action, meta.id, stopOnFailure)
        .returns(Q.resolve('PORT 1234'))
        .once();

    // port forwarding fails
    mockBridge.expects('portForward')
        .withArgs(9090, 1234)
        .returns(Q.reject(new Error()))
        .once();

    tasks.tizenTask(data)
        .then(function () {
          done(new Error('this should fail'));
        })
        .fail(function () {
          mockBridge.verify();
          tizenConfig.getMeta.restore();
          done();
        });
  });

  it('should run browser if port forwarded and browserCmd is set', function (done) {
    sinon.stub(tizenConfig, 'getMeta').returns(Q.resolve(meta));

    var stopOnFailure = false;
    var action = 'debug';
    var browserCmd = 'giggle-crom';
    var localPort = 9090;

    var data = {
      action: action,
      stopOnFailure: stopOnFailure,
      localPort: localPort,
      browserCmd: browserCmd
    };

    var mockBridge = sinon.mock(bridge);

    // bridge.launch returns PORT
    mockBridge.expects('launch')
        .withArgs(action, meta.id, stopOnFailure)
        .returns(Q.resolve('PORT 1234'))
        .once();

    // port forwarding succeeds
    mockBridge.expects('portForward')
        .withArgs(localPort, 1234)
        .returns(Q.resolve())
        .once();

    // run browser should be called
    mockBridge.expects('runBrowser')
        .withArgs(browserCmd, localPort)
        .returns(Q.resolve())
        .once();

    tasks.tizenTask(data)
        .then(function () {
          mockBridge.verify();
          tizenConfig.getMeta.restore();
          done();
        })
        .fail(done);
  });

  it('should resolve if port forwarded but no browserCmd set', function (done) {
    sinon.stub(tizenConfig, 'getMeta').returns(Q.resolve(meta));

    var stopOnFailure = false;
    var action = 'debug';
    var localPort = 9090;

    var data = {
      action: action,
      stopOnFailure: stopOnFailure,
      localPort: localPort
    };

    var mockBridge = sinon.mock(bridge);

    // bridge.launch returns PORT
    mockBridge.expects('launch')
        .withArgs(action, meta.id, stopOnFailure)
        .returns(Q.resolve('PORT 1234'))
        .once();

    // port forwarding succeeds
    mockBridge.expects('portForward')
        .withArgs(localPort, 1234)
        .returns(Q.resolve())
        .once();

    tasks.tizenTask(data)
        .then(function () {
          mockBridge.verify();
          tizenConfig.getMeta.restore();
          done();
        })
        .fail(done);
  });
});

describe('tizenTask asRoot', function () {
  var bridge = {
    install: function () {},
    root: function () {}
  };

  var tasks = tasksMaker({
    bridge: bridge,
    tizenConfig: {}
  });

  var err = new Error();

  var data = {
    action: 'install',
    asRoot: true,
    remoteFiles: '/tmp/package.wgt'
  };

  it('should fail task immediately if asRoot:true fails', function (done) {
    var mockBridge = sinon.mock(bridge);

    mockBridge.expects('root')
        .withArgs(true)
        .returns(Q.reject(new Error()))
        .once();

    tasks.tizenTask(data)
        .then(function () {
          done(new Error('this should fail'));
        })
        .fail(function () {
          mockBridge.verify();
          done();
        });
  });

  it('should run task if asRoot:true succeeds but fail when ' +
      'asRoot:false fails', function (done) {
    var mockBridge = sinon.mock(bridge);

    mockBridge.expects('root')
        .withArgs(true)
        .returns(Q.resolve())
        .once();

    mockBridge.expects('install')
        .withArgs(data.remoteFiles)
        .returns(Q.resolve())
        .once();

    mockBridge.expects('root')
        .withArgs(false)
        .returns(Q.reject(new Error()))
        .once();

    tasks.tizenTask(data)
        .then(function () {
          done(new Error('this should fail'));
        })
        .fail(function () {
          mockBridge.verify();
          done();
        });
  });

  it('should fail if asRoot:true succeeds but subcommand fails ' +
      'but still run asRoot:false', function (done) {
    var mockBridge = sinon.mock(bridge);

    mockBridge.expects('root')
        .withArgs(true)
        .returns(Q.resolve())
        .once();

    mockBridge.expects('install')
        .withArgs(data.remoteFiles)
        .returns(Q.reject(new Error()))
        .once();

    mockBridge.expects('root')
        .withArgs(false)
        .returns(Q.resolve())
        .once();

    tasks.tizenTask(data)
        .then(function () {
          done(new Error('this should fail'));
        })
        .fail(function () {
          mockBridge.verify();
          done();
        });
  });

  it('should run task successfully if asRoot:true, bridge action ' +
      'and asRoot:false all succeed', function (done) {
    var mockBridge = sinon.mock(bridge);

    mockBridge.expects('root')
        .withArgs(true)
        .returns(Q.resolve())
        .once();

    mockBridge.expects('install')
        .withArgs(data.remoteFiles)
        .returns(Q.resolve())
        .once();

    mockBridge.expects('root')
        .withArgs(false)
        .returns(Q.resolve())
        .once();

    tasks.tizenTask(data)
        .then(function () {
          mockBridge.verify();
          done();
        })
        .fail(done);
  });
});
