
export default class SatelliteViewModel {
  /**
   * Define the view model for the Satellite Selector feature.
   * @param {Globe} globe The globe model
   * @param {Function} updateSatelliteFn Function to update the tracked satellite
   * @returns {SatelliteViewModel}
   */
  constructor(globe, updateSatelliteFn) {
    const self = this;
    this.globe = globe;
    this.updateSatelliteFn = updateSatelliteFn;
    
    // Available satellites list with NORAD IDs and types
    this.availableSatellites = [
      { name: "ISS (ZARYA)", noradId: "25544", type: "space_station", scale: 2e6 },
      { name: "LANDSAT 9", noradId: "49260", type: "earth_observation", scale: 500 },
      { name: "AISSAT 2", noradId: "40075", type: "communication", scale: 150000 },
      { name: "SWISSCUBE", noradId: "35932", type: "cubesat", scale: 100000 },
      { name: "NOAA 19", noradId: "33591", type: "weather", scale: 15000 },
      { name: "NOAA 18", noradId: "28654", type: "weather", scale: 15000 },
      { name: "NOAA 15", noradId: "25338", type: "weather", scale: 15000 },
      { name: "ISS (NAUKA)", noradId: "49044", type: "space_station", scale: 2e6 },
      { name: "ZHUHAI-1 02 (CAS-4B)", noradId: "42759", type: "earth_observation", scale: 500 },
      { name: "ITASAT", noradId: "43786", type: "cubesat", scale: 100000 },
      { name: "NORSAT 3", noradId: "47814", type: "communication", scale: 150000 },
      { name: "NORSAT 2", noradId: "42826", type: "communication", scale: 150000 },
      { name: "CENTAURI-1", noradId: "43809", type: "cubesat", scale: 100000 },
      { name: "AISSAT 1", noradId: "36799", type: "communication", scale: 150000 },
      { name: "CENTAURI-3 (TYVAK-0210)", noradId: "47874", type: "cubesat", scale: 100000 },
      { name: "ROBUSTA 1B", noradId: "42792", type: "cubesat", scale: 100000 },
      { name: "KKS-1 (KISEKI)", noradId: "33499", type: "cubesat", scale: 100000 },
      { name: "NORSAT 1", noradId: "42825", type: "communication", scale: 150000 },
      { name: "PROXIMA I", noradId: "42925", type: "cubesat", scale: 100000 },
      { name: "PROXIMA II", noradId: "42926", type: "cubesat", scale: 100000 }
    ];
    
    // Default to ISS (ZARYA)
    this.selectedSatellite = ko.observable(this.availableSatellites.find(sat => sat.name === "ISS (ZARYA)"));
    
    /**
     * Select a satellite from the list
     * @param {Object} satellite The satellite object that was clicked
     */
    this.selectSatellite = function(satellite) {
      self.selectedSatellite(satellite);
    };
    
    /**
     * Change the currently tracked satellite
     */
    this.changeSatellite = function() {
      if (!self.selectedSatellite()) {
        return;
      }
      
      const satellite = self.selectedSatellite();
      console.log("Changing satellite to:", satellite.name, "NORAD ID:", satellite.noradId, "Type:", satellite.type);
      
      // Call the parent update function with satellite type and scale
      self.updateSatelliteFn(satellite.noradId, satellite.name, satellite.type, satellite.scale);
      
      // Update the flyover view model satellite name
      if (window.flyoverViewModel) {
        window.flyoverViewModel.satelliteName(satellite.name);
        
        // Reset any existing flyover data since we changed satellites
        window.flyoverViewModel.flyoverPasses.removeAll();
        window.flyoverViewModel.resetView();
      }
    };
  }
}