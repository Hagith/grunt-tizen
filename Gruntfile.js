module.exports = function (grunt) {
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-mochaccino');
  grunt.loadNpmTasks('grunt-release');
  grunt.loadNpmTasks('grunt-conventional-changelog');

  grunt.initConfig({
    clean: ['build'],

    jshint: {
      all: ['lib/**/*.js', 'tasks/**'],

      // see http://jshint.com/docs/
      options: {
        camelcase: true,
        curly: true,
        eqeqeq: true,
        forin: true,
        immed: true,
        indent: 2,
        noempty: true,
        quotmark: 'single',

        undef: true,
        globals: {
          'require': false,
          'module': false,
          'process': false,
          '__dirname': false,
          'console': false
        },

        unused: true,
        browser: true,
        strict: true,
        trailing: true,
        maxdepth: 2,
        newcap: false
      }
    },

    mochaccino: {
      // this provides coverage for both unit and integration tests
      cov: {
        files: [
          { src: 'test/unit/*.test.js' },
          { src: 'test/integration/*.test.js' }
        ],
        reporter: 'html-cov',
        reportDir: 'build'
      },

      unit: {
        files: { src: 'test/unit/*.test.js' },
        reporter: 'dot'
      },

      // integration tests
      int: {
        files: { src: 'test/integration/*.test.js' },
        reporter: 'dot'
      }
    },

    release: {
      options: {
        // manage add/commit/push manually
        add: true,
        commit: true,
        push: true,

        bump: true,
        tag: true,
        pushTags: true,
        npm: true,
        folder: '.',
        tagName: '<%= version %>',
        tagMessage: 'Version <%= version %>'
      }
    }

  });

  grunt.registerTask('test', 'mochaccino:unit');
  grunt.registerTask('test-int', 'mochaccino:int');
  grunt.registerTask('cov', 'mochaccino:cov');
  grunt.registerTask('lint', 'jshint');
  grunt.registerTask('all', [
    'jshint',
    'mochaccino:unit',
    'mochaccino:int'
  ]);
  grunt.registerTask('default', 'all');
};
