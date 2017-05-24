"use strict";

/***
 *  Define the app and inject any modules we wish to
 *  refer to.
***/
var app = angular.module("RpiWifiConfig", []);

/******************************************************************************\
Function:
    AppController
Dependencies:
    ...
Description:
    Main application controller
\******************************************************************************/
app.controller("AppController", ["PiManager", "$scope", "$location", "$timeout",

    function(PiManager, $scope, $location, $timeout) {
        // Scope variable declaration
        $scope.scan_results              = [];
        $scope.selected_cell             = null;
        $scope.scan_running              = false;
        $scope.network_passcode          = "";
        $scope.show_passcode_entry_field = false;
        $scope.connecting                = false;

        // Scope filter definitions
        $scope.orderScanResults = function(cell) {
            return parseInt(cell.signal_strength);
        }

        $scope.foo = function() { console.log("foo"); }
        $scope.bar = function() { console.log("bar"); }

        // Scope function definitions
        $scope.rescan = function() {
            $scope.scan_results = [];
            $scope.selected_cell = null;
            $scope.scan_running = true;
            PiManager.rescan_wifi().then(function(response) {
                console.log(response.data);
                if (response.data.status == "SUCCESS") {
                    $scope.scan_results = response.data.scan_results;
                }
                $scope.scan_running = false;
            });
        }

        $scope.change_selection = function(cell) {
            $scope.network_passcode = "";
            $scope.selected_cell = cell;
            $scope.show_passcode_entry_field = (cell != null) ? true : false;
        }

        $scope.submit_selection = function() {
            var connected = true;

            if (!$scope.selected_cell) return;

            $scope.connecting = true;
            var wifi_info = {
                wifi_ssid:      $scope.selected_cell["ssid"],
                wifi_passcode:  $scope.network_passcode,
            };

            PiManager.enable_wifi(wifi_info).then(
                function(response) { //SUCCESS
                    $scope.connecting = false;
                    console.log(response.data);
                    if (response.data.status == "SUCCESS") {
                    } else {
                        alert("Connecting failed");
                        connected = false;
                    }
                },
                function (response) { //ERROR
                    if (response.status === -1) { //probably network error after AP was switched of
                        // wait for 2 minutes (AP should be up by then - when connecting to the wifi failed) and then
                        // check for the wifi status message (wifi status message should return error, in case of success
                        // access point should not come up at all)
                        console.log("network error, waiting 2 minutes and then asking for wifi status")
                        setTimeout(function () {
                            PiManager.get_wifi_status().then(
                                function (response) { //SUCCESS
                                    $scope.connecting = false;
                                    if(response.data.status == "error") {
                                      alert("Connecting failed");
                                      connected = false;
                                    }
                                    console.log(response)
                                },
                                function (response) { //ERROR
                                    $scope.connecting = false;
                                    console.log(response)
                                }
                            );
                        }, 1000 * 60 * 2);
                    }
                }
            );

            setTimeout(function () {
                if (connected) {
                    $scope.connecting = false;
                    alert("Connecting successful");
                }
            }, (1000 * 60 * 2) + 30 * 1000); //2m 30sec
        }

        // Defer load the scanned results from the rpi
        $scope.rescan();
    }]
);

/*****************************************************************************\
    Service to hit the rpi wifi config server
\*****************************************************************************/
app.service("PiManager", ["$http",

    function($http) {
        return {
            rescan_wifi: function() {
                return $http.get("/api/rescan_wifi");
            },
            enable_wifi: function(wifi_info, successHandler, errorHandler) {
                return $http.post("/api/enable_wifi", wifi_info);
            },

            get_wifi_status: function() {
                return $http.get("/api/wifi_status");
            }
        };
    }]

);

/*****************************************************************************\
    Directive to show / hide / clear the password prompt
\*****************************************************************************/
app.directive("rwcPasswordEntry", function($timeout) {
    return {
        restrict: "E",

        scope: {
            visible:  "=",
            passcode: "=",
            reset:    "&",
            submit:   "&",
            connecting: "=",
        },

        replace: true,          // Use provided template (as opposed to static
                                // content that the modal scope might define in the
                                // DOM)

        template: [
            "<div class='rwc-password-entry-container' ng-class='{\"hide-me\": !visible}'>",
            "    <div class='box'>",
            "         <input type = 'password' placeholder = 'Passcode...' ng-model = 'passcode' />",
            "         <div class = 'btn btn-cancel' ng-click = 'reset(null)'>Cancel</div>",
            "         <div class = 'btn btn-ok' ng-click = 'submit()'>Submit</div>",
            "         <span class = 'connection-info loading' ng-class='{\"hide-me\": !connecting}'>Connecting</span>",
            "         <span class = 'connection-info extra-info' ng-class='{\"hide-me\": !connecting}'>( may take several minutes )</span>",
            "    </div>",
            "</div>"
        ].join("\n"),

        // Link function to bind modal to the app
        link: function(scope, element, attributes) {
        },
    };
});
