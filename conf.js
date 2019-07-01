var HtmlReporter = require('protractor-beautiful-reporter');

exports.config = {
  seleniumAddress: 'http://localhost:4444/wd/hub',
  directConnect: true,
  specs: ['spec1.js'],

onPrepare: function() {
    // Add a screenshot reporter and store screenshots to `/tmp/screenshots`:
    jasmine.getEnv().addReporter(new HtmlReporter({
       baseDirectory: 'tmp/screenshots'
    }).getJasmine2Reporter());
 }
};