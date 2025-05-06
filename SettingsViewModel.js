
import Globe from './Globe.js'

  /* global ko, WorldWind */

  export default class SettingsViewModel {
  /**
   * Constructs a view model for the application settings.
   * @param {Globe} globe
   */
  constructor(globe) {
    let self = this;

    this.globe = globe;
    this.settingLayers = ko.observableArray(globe.getLayers('setting').reverse());
    this.debugLayers = ko.observableArray(globe.getLayers('debug').reverse());

    // Button click event handler used in the html view
    this.toggleLayer = function (layer) {
      self.globe.toggleLayer(layer);
    };

    // Update this view model whenever one of the layer categories change
    globe.getCategoryTimestamp('setting').subscribe(newValue =>
      Globe.loadLayers(globe.getLayers('setting'), self.settingLayers));
    globe.getCategoryTimestamp('debug').subscribe(newValue =>
      Globe.loadLayers(globe.getLayers('debug'), self.debugLayers));
  }
}

