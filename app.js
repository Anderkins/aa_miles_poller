var request = require('request'),
    moment = require('moment'),
    config = require('./config'),               // Twilio config
    destinations = require('./destinations'),   // Destinations setup file
    airports = require('./airports'),           // Airports/area file
    statusCodes = require('http').STATUS_CODES,
    twilio = require('twilio')(config.account_sid, config.auth_token),
    http = require('http'),
    server,
    port = process.env.PORT || 3008,
    dests = [],
    monitors = [],
    lastChecked = moment().format("LLL");

/*
    Contstruct that poller
*/

function Poll (opts) {
    this.reqURL = '';
    this.frequency = 10;
    this.handle = null;
    this.init(opts);
    this.lastMiles = "Checking...";
}

/*
    Methods
*/

Poll.prototype = {

    init: function (opts) {
        var self = this;
        self.airportCode = opts.airportCode;
        self.categoryOverride = opts.categoryOverride;
        self.originatingAirport = opts.originatingAirport;
        self.departureDate = opts.departureDate;
        self.returnDate = opts.returnDate;
        self.threshold = opts.threshold;
        self.frequency = (opts.frequency * (60 * 1000));
        self.category = self.findAirportCategory();
        self.reqURL = self.buildReqURL();
        self.runIntervals();
        self.lastMiles = opts.lastMiles;
    },

    // Set up our loop intervals
    runIntervals: function () {

        var self = this;

        self.handle = setInterval(function () {
           self.fetch();
        }, self.frequency);

    },

    // Search airports.js for our category based on our destination airport
    findAirportCategory: function() {

        var self = this;

        if (typeof(self.categoryOverride) !== 'undefined') {
            console.log("Using override category...");
            return self.categoryOverride;
        } else {
            console.log("Finding airport...");
            category = airports.filter(function(object) {
                return object.cities.indexOf(self.airportCode) > 0;
            })[0];
        }

        if (typeof(category) === 'undefined') {
            console.log("Your desintaion airport could not be found in the default list. Please see 'airports.js' for a workaround.");
            self.killHandler();
        } else {
            return category.area;
        }
    },

    // Build the request url out of our options
    buildReqURL: function() {
        var d = this;
        return "https://www.aa.com/awardMap/api/search?destination=&origin="+d.originatingAirport+"&category="+d.category+"&departureMinDate="+ encodeURI(d.departureDate)+"&returnMinDate="+encodeURI(d.returnDate)+"&pax=1&miles=900%2C000&roundTrip=true&cabin=ECONOMY&maxStopCount=3&includePartners=true&_includePartners=on";
    },

    // Fetch a response from the AA servers
    fetch: function () {

        var self = this;

        try {
            request(self.reqURL+"&i="+Date.now(), function (error, res, body) {
                if (!error && res.statusCode === 200) {
                    self.checkMiles(body, res);
                }
                else {
                   self.badResponse(error);
                }
            });
        }
        catch (error) {
            self.badResponse();
        }

    },


    // Send a text. der.
    sendText: function(message){

        twilio.sendMessage({
            to:'+19255254790',
            from: '+19259684776',
            body: message
        });

    },

    // Run the actual mileage check / comparison
    checkMiles: function (body, res) {

        var self = this,
            parse = JSON.parse(body),
            status = "no change..."

        lastChecked = moment().format("LLL");

        airport = parse.airports.filter(function(object) {
            return object.airport.code == self.airportCode;
        })[0];

        if (airport.miles < self.threshold) {
            status = "success!"
            self.sendText('Cheaper airfaire found! Flights to ' + self.airportCode + " for only " + airport.miles);
        }

        self.lastMiles = airport.miles;
        console.log("Current miles: " + airport.miles + " / Time: " + lastChecked + " / Status: " +status);
    },

    // kill the handler so it doesn't blow up yer texts.
    killHandler: function() {

        console.log("Killing search for "+this.airportCode+ " at "+ moment().format("LLL"));
        clearInterval(this.handle);
        this.handle = null;

    },

    // Something went wrong. Handle it.
    badResponse: function (statusCode) {

        self.killHandler();

        if (typeof(statusCode)==='undefined') {
            status = " an unknown error. Check your URL and restart the server.";
        } else {
            status = " the following error code: "+ statusCodes[statusCode + ''];
        }

        this.sendText("Mileage checker whoopsie! The search for airport " + this.airportCode + " has been killed due to");
    },

    // Helper function for printing list of airports. Used to generate airports.js
    printAirports: function(body) {

        var airportList = [];

        parse = JSON.parse(body);
        airportList = parse.airports.map(function(a) {console.log("\"" + a.airport.code + "\", // " + a.airport.cityName + ", " + a.airport.countryName)});

    }

}

destinations.forEach(function (dest) {

    var monitor = new Poll ({
        reqURL: dest.reqURL,
        threshold: dest.threshold,
        airportCode: dest.airportCode,
        originatingAirport: dest.originatingAirport,
        departureDate: dest.departureDate,
        returnDate: dest.returnDate,
        categoryOverride: dest.categoryOverride,
        frequency: dest.frequency
    });

    dests.push(" - " + monitor.airportCode + ": " + monitor.threshold + " miles / Last Found for: " + monitor.lastMiles);
    monitors.push(monitor);

});


server = http.createServer(function (req, res) {

    var data = "Looking for lower airfaires for the following airports: \n \n" + dests.join("\n") + " \n \nLast checked: " + lastChecked;
    res.end(data);

});

server.listen(port);
console.log('Listening to port %s', port);