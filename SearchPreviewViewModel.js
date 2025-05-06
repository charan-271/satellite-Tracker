
import Globe from './Globe.js';

/* global $, ko, WorldWind */

export default class SearchPreviewViewModel {
  /**
   * Define the view model for the Search Preview.
   * @param {WorldWindow} primaryGlobe
   * @param {String} nominatimBaseUrl The Nominatim API base URL used for geocoding. Default: https://nominatim.openstreetmap.org
   * @returns {PreviewViewModel}
   */
  constructor(primaryGlobe, nominatimBaseUrl) {
    var self = this;
    // Show a warning message about the Nominatim API usage policy if needed
    this.showApiWarning = (nominatimBaseUrl === null || nominatimBaseUrl === "");
    this.nominatimBaseUrl = nominatimBaseUrl || "https://nominatim.openstreetmap.org";

    // Create secondary globe with a 2D Mercator projection for the preview
    this.previewGlobe = new Globe("preview-canvas", "Mercator");
    let resultsLayer = new WorldWind.RenderableLayer("Results");
    
    // Replace Bing layer with standard BMNG layer
    let baseLayer = new WorldWind.BMNGLayer();
    this.previewGlobe.addLayer(baseLayer);
    this.previewGlobe.addLayer(resultsLayer);

    // Set up the common placemark attributes for the results
    let placemarkAttributes = new WorldWind.PlacemarkAttributes(null);
    placemarkAttributes.imageSource = WorldWind.configuration.baseUrl + "images/pushpins/castshadow-red.png";
    placemarkAttributes.imageScale = 0.5;
    placemarkAttributes.imageOffset = new WorldWind.Offset(
      WorldWind.OFFSET_FRACTION, 0.3,
      WorldWind.OFFSET_FRACTION, 0.0);

    // Create an observable array who's contents are displayed in the preview
    this.searchResults = ko.observableArray();
    this.selected = ko.observable();

    // Shows the given search results in a table with a preview globe/map
    this.previewResults = function (results) {
      if (results.length === 0) {
        return;
      }
      // Clear the previous results
      self.searchResults.removeAll();
      resultsLayer.removeAllRenderables();
      // Add the results to the observable array
      results.map(item => self.searchResults.push(item));
      // Create a simple placemark for each result
      for (let i = 0, max = results.length; i < max; i++) {
        let item = results[i];
        let placemark = new WorldWind.Placemark(
          new WorldWind.Position(
            parseFloat(item.lat),
            parseFloat(item.lon), 100));
        placemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
        placemark.displayName = item.display_name;
        placemark.attributes = placemarkAttributes;
        resultsLayer.addRenderable(placemark);
      }

      // Initialize preview with the first item
      self.previewSelection(results[0]);
      // Display the preview dialog
      $('#previewDialog').modal();
      $('#previewDialog .modal-body-table').scrollTop(0);
    };
    
    this.previewSelection = function (selection) {
      let latitude = parseFloat(selection.lat),
        longitude = parseFloat(selection.lon),
        location = new WorldWind.Location(latitude, longitude);
      // Update our observable holding the selected location
      self.selected(location);
      // Go to the position
      self.previewGlobe.wwd.goTo(location);
    };
    
    this.gotoSelected = function () {
      // Go to the location held in the selected observable
      primaryGlobe.wwd.goTo(self.selected());
    };
  }
}
