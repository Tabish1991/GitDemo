var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    }
    else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    }
    else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};


//</editor-fold>

app.controller('ScreenshotReportController', function ($scope, $http) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
    }

    this.showSmartStackTraceHighlight = true;

    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };

    this.convertTimestamp = function (timestamp) {
        var d = new Date(timestamp),
            yyyy = d.getFullYear(),
            mm = ('0' + (d.getMonth() + 1)).slice(-2),
            dd = ('0' + d.getDate()).slice(-2),
            hh = d.getHours(),
            h = hh,
            min = ('0' + d.getMinutes()).slice(-2),
            ampm = 'AM',
            time;

        if (hh > 12) {
            h = hh - 12;
            ampm = 'PM';
        } else if (hh === 12) {
            h = 12;
            ampm = 'PM';
        } else if (hh === 0) {
            h = 12;
        }

        // ie: 2013-02-18, 8:35 AM
        time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

        return time;
    };


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };


    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };

    this.applySmartHighlight = function (line) {
        if (this.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return true;
    };

    var results = [
    {
        "description": "This app will add two number|This is my second protractor test",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 1532,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://juliemr.github.io/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1558739282228,
                "type": ""
            }
        ],
        "screenShotFile": "005a00de-00ed-0035-0006-006400780081.png",
        "timestamp": 1558739278060,
        "duration": 6618
    },
    {
        "description": "This app will add two number|This is my second protractor test",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 4320,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": [
            "Expected '10' to equal '30'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\sabiha\\workspace\\ProtractorTutorials\\Day 2\\secondTest-spec.js:10:56)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://juliemr.github.io/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1558739704812,
                "type": ""
            }
        ],
        "screenShotFile": "001100f3-005b-0087-007d-00120067003f.png",
        "timestamp": 1558739701550,
        "duration": 5444
    },
    {
        "description": "This test will submit a form|This is my first non angular protractor test",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 680,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": [
            "Failed: Angular could not be found on the page https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load"
        ],
        "trace": [
            "Error: Angular could not be found on the page https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load\n    at executeAsyncScript_.then (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:720:27)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"This test will submit a form\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\sabiha\\workspace\\ProtractorTutorials\\Day 2\\nonAngularApp-spec.js:3:1)\n    at addSpecsToSuite (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\sabiha\\workspace\\ProtractorTutorials\\Day 2\\nonAngularApp-spec.js:1:63)\n    at Module._compile (internal/modules/cjs/loader.js:701:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:712:10)\n    at Module.load (internal/modules/cjs/loader.js:600:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:539:12)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html - [Report Only] Refused to load the image 'http://docs.seleniumhq.org/images/big-logo.png' because it violates the following Content Security Policy directive: \"default-src https: blob: data: 'unsafe-inline' 'unsafe-eval'\". Note that 'img-src' was not explicitly set, so 'default-src' is used as a fallback.\n",
                "timestamp": 1558775602123,
                "type": ""
            }
        ],
        "screenShotFile": "00c900eb-00d6-003d-009a-007c001400f5.png",
        "timestamp": 1558775599008,
        "duration": 15889
    },
    {
        "description": "This test will submit a form|This is my first non angular protractor test",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 4872,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html 747 Mixed Content: The page at 'https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html' was loaded over HTTPS, but requested an insecure image 'http://docs.seleniumhq.org/images/big-logo.png'. This content should also be served over HTTPS.",
                "timestamp": 1558776212614,
                "type": ""
            }
        ],
        "screenShotFile": "00780037-0013-002e-00f3-006a0042005d.png",
        "timestamp": 1558776208264,
        "duration": 8200
    },
    {
        "description": "This test will submit a form|This is my first non angular protractor test",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3712,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": [
            "Failed: browser.driver.element is not a function"
        ],
        "trace": [
            "TypeError: browser.driver.element is not a function\n    at UserContext.<anonymous> (C:\\Users\\sabiha\\workspace\\ProtractorTutorials\\Day 2\\nonAngularApp-spec.js:9:17)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"This test will submit a form\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\sabiha\\workspace\\ProtractorTutorials\\Day 2\\nonAngularApp-spec.js:3:1)\n    at addSpecsToSuite (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\sabiha\\workspace\\ProtractorTutorials\\Day 2\\nonAngularApp-spec.js:1:63)\n    at Module._compile (internal/modules/cjs/loader.js:701:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:712:10)\n    at Module.load (internal/modules/cjs/loader.js:600:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:539:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "004300a4-007f-000d-00ed-00e400a4000f.png",
        "timestamp": 1558776465951,
        "duration": 16
    },
    {
        "description": "This test will submit a form|This is my first non angular protractor test",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 4384,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": [
            "Failed: browser.driver.element is not a function"
        ],
        "trace": [
            "TypeError: browser.driver.element is not a function\n    at UserContext.<anonymous> (C:\\Users\\sabiha\\workspace\\ProtractorTutorials\\Day 2\\nonAngularApp-spec.js:7:17)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"This test will submit a form\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\sabiha\\workspace\\ProtractorTutorials\\Day 2\\nonAngularApp-spec.js:3:1)\n    at addSpecsToSuite (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\sabiha\\workspace\\ProtractorTutorials\\Day 2\\nonAngularApp-spec.js:1:63)\n    at Module._compile (internal/modules/cjs/loader.js:701:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:712:10)\n    at Module.load (internal/modules/cjs/loader.js:600:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:539:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0036009a-00a6-00e6-00ad-00dc005f0079.png",
        "timestamp": 1558776510554,
        "duration": 16
    },
    {
        "description": "This test will submit a form|This is my first non angular protractor test",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5516,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": [
            "Failed: browser.driver.findelement is not a function"
        ],
        "trace": [
            "TypeError: browser.driver.findelement is not a function\n    at UserContext.<anonymous> (C:\\Users\\sabiha\\workspace\\ProtractorTutorials\\Day 2\\nonAngularApp-spec.js:7:17)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"This test will submit a form\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\sabiha\\workspace\\ProtractorTutorials\\Day 2\\nonAngularApp-spec.js:3:1)\n    at addSpecsToSuite (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\sabiha\\workspace\\ProtractorTutorials\\Day 2\\nonAngularApp-spec.js:1:63)\n    at Module._compile (internal/modules/cjs/loader.js:701:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:712:10)\n    at Module.load (internal/modules/cjs/loader.js:600:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:539:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "007a000f-0099-0069-0006-001b0010009b.png",
        "timestamp": 1558776600145,
        "duration": 20
    },
    {
        "description": "This test will submit a form|This is my first non angular protractor test",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 4936,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html 747 Mixed Content: The page at 'https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html' was loaded over HTTPS, but requested an insecure image 'http://docs.seleniumhq.org/images/big-logo.png'. This content should also be served over HTTPS.",
                "timestamp": 1558776662631,
                "type": ""
            }
        ],
        "screenShotFile": "00660076-0033-0035-00f0-0052003a0054.png",
        "timestamp": 1558776659307,
        "duration": 6442
    },
    {
        "description": "This test will submit a form|This is my first non angular protractor test",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3088,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html 747 Mixed Content: The page at 'https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html' was loaded over HTTPS, but requested an insecure image 'http://docs.seleniumhq.org/images/big-logo.png'. This content should also be served over HTTPS.",
                "timestamp": 1558776752736,
                "type": ""
            }
        ],
        "screenShotFile": "00720027-00ba-007f-0055-00b400d900a6.png",
        "timestamp": 1558776748461,
        "duration": 10509
    },
    {
        "description": "This test will submit a form|This is my first non angular protractor test",
        "passed": true,
        "pending": false,
        "instanceId": 1724,
        "browser": {
            "name": "firefox"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e40046-0005-00e1-0090-009e002a00d0.png",
        "timestamp": 1558777244533,
        "duration": 10961
    },
    {
        "description": "This test will submit a form|This is my first non angular protractor test",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5408,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html 747 Mixed Content: The page at 'https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html' was loaded over HTTPS, but requested an insecure image 'http://docs.seleniumhq.org/images/big-logo.png'. This content should also be served over HTTPS.",
                "timestamp": 1558777378586,
                "type": ""
            }
        ],
        "screenShotFile": "00ac00d6-00eb-0049-007e-005e00460058.png",
        "timestamp": 1558777374641,
        "duration": 7251
    },
    {
        "description": "This test will submit a form|This is my first non angular protractor test",
        "passed": true,
        "pending": false,
        "instanceId": 5444,
        "browser": {
            "name": "firefox"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004600c7-003c-003d-0047-00c400a300db.png",
        "timestamp": 1558777391348,
        "duration": 5656
    },
    {
        "description": "This test will submit a form|This is my first non angular protractor test",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 6084,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html 747 Mixed Content: The page at 'https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html' was loaded over HTTPS, but requested an insecure image 'http://docs.seleniumhq.org/images/big-logo.png'. This content should also be served over HTTPS.",
                "timestamp": 1558777889885,
                "type": ""
            }
        ],
        "screenShotFile": "009900df-0075-0036-00b5-00b80018005d.png",
        "timestamp": 1558777886490,
        "duration": 7672
    },
    {
        "description": "This test will submit a form|This is my first non angular protractor test",
        "passed": true,
        "pending": false,
        "instanceId": 4120,
        "browser": {
            "name": "firefox"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00890096-0063-0027-001e-00b4006b007c.png",
        "timestamp": 1558778057057,
        "duration": 7759
    },
    {
        "description": "This test will submit a form|This is my first non angular protractor test",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5592,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html 747 Mixed Content: The page at 'https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html' was loaded over HTTPS, but requested an insecure image 'http://docs.seleniumhq.org/images/big-logo.png'. This content should also be served over HTTPS.",
                "timestamp": 1558778155433,
                "type": ""
            }
        ],
        "screenShotFile": "00580031-004e-008a-0072-00db00d2003b.png",
        "timestamp": 1558778153827,
        "duration": 4946
    },
    {
        "description": "This test will submit a form|This is my first non angular protractor test",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 7040,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html - [Report Only] Refused to load the image 'http://docs.seleniumhq.org/images/big-logo.png' because it violates the following Content Security Policy directive: \"default-src https: blob: data: 'unsafe-inline' 'unsafe-eval'\". Note that 'img-src' was not explicitly set, so 'default-src' is used as a fallback.\n",
                "timestamp": 1558834824355,
                "type": ""
            }
        ],
        "screenShotFile": "00210069-0016-00df-00d3-00a500430059.png",
        "timestamp": 1558834821189,
        "duration": 9359
    },
    {
        "description": "This test will submit a form|This is my first non angular protractor test",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 1620,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html 747 Mixed Content: The page at 'https://seleniumpractise.blogspot.com/2016/09/complete-registration-form.html' was loaded over HTTPS, but requested an insecure image 'http://docs.seleniumhq.org/images/big-logo.png'. This content should also be served over HTTPS.",
                "timestamp": 1559006303018,
                "type": ""
            }
        ],
        "screenShotFile": "00e900b8-0084-00ca-008f-002200450002.png",
        "timestamp": 1559006300994,
        "duration": 7395
    },
    {
        "description": "open angularjs websites|Protractor baby steps",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 3632,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": [
            "Failed: invalid element state: Failed to execute 'replace' on 'Location': '%27https://angularjs.org' is not a valid URL.\n  (Session info: chrome=74.0.3729.169)\n  (Driver info: chromedriver=74.0.3729.6 (255758eccf3d244491b8a1317aa76e1ce10d57e9-refs/branch-heads/3729@{#29}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "InvalidElementStateError: invalid element state: Failed to execute 'replace' on 'Location': '%27https://angularjs.org' is not a valid URL.\n  (Session info: chrome=74.0.3729.169)\n  (Driver info: chromedriver=74.0.3729.6 (255758eccf3d244491b8a1317aa76e1ce10d57e9-refs/branch-heads/3729@{#29}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Protractor.get(%27https://angularjs.org) - reset url\n    at Driver.schedule (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeScriptWithDescription (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:404:28)\n    at driver.controlFlow.execute.then.then.then (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:679:25)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"open angularjs websites\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\sabiha\\workspace\\ProtractorTutorials\\spec1.js:3:1)\n    at addSpecsToSuite (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\sabiha\\workspace\\ProtractorTutorials\\spec1.js:1:63)\n    at Module._compile (internal/modules/cjs/loader.js:701:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:712:10)\n    at Module.load (internal/modules/cjs/loader.js:600:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:539:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00d600e0-0006-000f-00c5-00fe00f700e4.png",
        "timestamp": 1559080636611,
        "duration": 417
    },
    {
        "description": "open angularjs websites|Protractor baby steps",
        "passed": false,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 4824,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": [
            "Failed: invalid element state: Failed to execute 'replace' on 'Location': '%27https://angularjs.org' is not a valid URL.\n  (Session info: chrome=74.0.3729.169)\n  (Driver info: chromedriver=74.0.3729.6 (255758eccf3d244491b8a1317aa76e1ce10d57e9-refs/branch-heads/3729@{#29}),platform=Windows NT 6.1.7601 SP1 x86_64)"
        ],
        "trace": [
            "InvalidElementStateError: invalid element state: Failed to execute 'replace' on 'Location': '%27https://angularjs.org' is not a valid URL.\n  (Session info: chrome=74.0.3729.169)\n  (Driver info: chromedriver=74.0.3729.6 (255758eccf3d244491b8a1317aa76e1ce10d57e9-refs/branch-heads/3729@{#29}),platform=Windows NT 6.1.7601 SP1 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at doSend.then.response (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30)\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Protractor.get(%27https://angularjs.org) - reset url\n    at Driver.schedule (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeScriptWithDescription (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:404:28)\n    at driver.controlFlow.execute.then.then.then (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:679:25)\n    at ManagedPromise.invokeCallback_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at asyncRun (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at process._tickCallback (internal/process/next_tick.js:68:7)\nFrom: Task: Run it(\"open angularjs websites\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at shutdownTask_.MicroTask (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\sabiha\\workspace\\ProtractorTutorials\\spec1.js:3:1)\n    at addSpecsToSuite (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\sabiha\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\sabiha\\workspace\\ProtractorTutorials\\spec1.js:1:63)\n    at Module._compile (internal/modules/cjs/loader.js:701:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:712:10)\n    at Module.load (internal/modules/cjs/loader.js:600:32)\n    at tryModuleLoad (internal/modules/cjs/loader.js:539:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "005a006f-0091-00d6-00f9-00c700bb008b.png",
        "timestamp": 1559080909321,
        "duration": 130
    },
    {
        "description": "close browser|Protractor baby steps",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 4824,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007e006a-00e6-0006-003a-007100cc00be.png",
        "timestamp": 1559080909828,
        "duration": 2
    },
    {
        "description": "open angularjs websites|Protractor baby steps",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5036,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a8006f-0083-0000-0066-00000066006f.png",
        "timestamp": 1559080946953,
        "duration": 4252
    },
    {
        "description": "close browser|Protractor baby steps",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 5036,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ec000e-00c6-0005-00c0-003900b600e4.png",
        "timestamp": 1559080951641,
        "duration": 2
    },
    {
        "description": "open angularjs websites|Protractor baby steps",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 4556,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004800d1-00b2-0029-0044-0053007c0096.png",
        "timestamp": 1559080991866,
        "duration": 3765
    },
    {
        "description": "close browser|Protractor baby steps",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 4556,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009900b5-006c-000c-00f1-00e6001d007a.png",
        "timestamp": 1559080996177,
        "duration": 2
    },
    {
        "description": "open angularjs websites|Protractor baby steps",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 2944,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00610073-009b-001d-00c7-00d600d500ab.png",
        "timestamp": 1559081373872,
        "duration": 4573
    },
    {
        "description": "close browser|Protractor baby steps",
        "passed": true,
        "pending": false,
        "os": "Windows NT",
        "instanceId": 2944,
        "browser": {
            "name": "chrome",
            "version": "74.0.3729.169"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c700a6-00d3-0055-001f-006900a70060.png",
        "timestamp": 1559081378891,
        "duration": 2
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    }
                    else
                    {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.sortSpecs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.sortSpecs();
    }


});

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

