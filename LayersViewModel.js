
import Globe from './Globe.js';

/* global ko, WorldWind */

export default class LayersViewModel {
  /**
   * Constructs a view model for the globe's layers.
   * @param {Globe} globe
   */
  constructor(globe) {
    let self = this;

    this.globe = globe;
    this.baseLayers = ko.observableArray(globe.getLayers('base').reverse());
    this.overlayLayers = ko.observableArray(globe.getLayers('overlay').reverse());

    // Update the view model whenever the model changes
    globe.getCategoryTimestamp('base').subscribe(newValue =>
      Globe.loadLayers(globe.getLayers('base'), self.baseLayers));
    globe.getCategoryTimestamp('overlay').subscribe(newValue =>
      Globe.loadLayers(globe.getLayers('overlay'), self.overlayLayers));

    // Button click event handler specified in index.html view
    this.toggleLayer = function (layer) {
      self.globe.toggleLayer(layer);
      // Zoom to the layer if it has a bbox assigned to it
      if (layer.enabled && layer.bbox) {
        self.globe.zoomToLayer(layer);
      }
    };
  }
}

