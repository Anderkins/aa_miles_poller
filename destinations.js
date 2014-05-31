/*
* Destination! Use this to set up your search(es).
*/

module.exports = [{
  airportCode: "UIO",           // Airport to search for
  originatingAirport: "JFK",    // Airport code of where you're leaving from
  threshold: 70000,             // Mileage threshold (aka alert you if returned mileage goes below this amount). No commas!
  departureDate: "08/05/2014",  // Zero-padded departure date (formatted with MM/DD/YYY)
  returnDate: "08/13/2014",     // Zero-padded return date (formatted with MM/DD/YYY)

  // NOTE: See comments in "airports.js" for the use of this property.
  // categoryOverride: "EUROPE",

  frequency: 30 // check every X minutes
}];