
export default class SearchViewModel {
  /**
   * Search view model. Uses the OpenStreetMap Nominatim API. 
   * See usage policy: https://operations.osmfoundation.org/policies/nominatim/
   * @param {Globe} globe
   * @param {Function} preview Function to preview the results
   * @param {String} nominatimBaseUrl The base URL for the Nominatim API. Default: https://nominatim.openstreetmap.org
   * @returns {SearchViewModel}
   */
  constructor(globe, preview, nominatimBaseUrl) {
    var self = this;
    this.geocoder = new WorldWind.NominatimGeocoder(nominatimBaseUrl);
    this.searchText = ko.observable('');
    this.nominatimBaseUrl = nominatimBaseUrl || "https://nominatim.openstreetmap.org";
    
    /**
     * Search function
     */
    this.performSearch = function () {
      // Get the value from the observable
      let queryString = self.searchText();
      if (queryString) {
        if (queryString.match(WorldWind.WWUtil.latLonRegex)) {
          // Treat the text as a lat, lon pair 
          let tokens = queryString.split(",");
          let latitude = parseFloat(tokens[0]);
          let longitude = parseFloat(tokens[1]);
          // Center the globe on the lat, lon
          globe.wwd.goTo(new WorldWind.Location(latitude, longitude));
        } else {
          // Treat the text as an address or place name
          // Use custom lookup to work with Nominatim API directly
          self.lookupLocation(queryString, function(results) {
            if (results.length > 0) {
              // Open the modal dialog to preview and select a result
              preview(results);
            }
          });
        }
      }
    };
    
    /**
     * Custom lookup function for Nominatim API
     * @param {String} query The location query string
     * @param {Function} callback The function to call when results are available
     */
    this.lookupLocation = function(query, callback) {
      // Create the URL for the Nominatim API request
      let url = `${self.nominatimBaseUrl}/search?q=${encodeURIComponent(query)}&format=json&limit=10`;
      
      // Add important headers for Nominatim API
      $.ajax({
        url: url,
        dataType: 'json',
        headers: {
          'User-Agent': 'ISS-Tracker/1.0',  // Required by Nominatim usage policy
          'Accept-Language': navigator.language || 'en' // Use browser language
        },
        success: function(data) {
          callback(data);
        },
        error: function(xhr, status, error) {
          console.error('Nominatim API error:', status, error);
          callback([]);
        }
      });
    };
  }
}

