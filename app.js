
import Globe from './Globe.js';
import LayersViewModel from './LayersViewModel.js';
import SettingsViewModel from './SettingsViewModel.js';
import SearchPreviewViewModel from './SearchPreviewViewModel.js';
import FlyoverViewModel from './FlyoverViewModel.js';
import SatelliteViewModel from './SatelliteViewModel.js';

/* global $, ko, WorldWind, tlejs */

// Base URL for TLE data - will be updated with specific satellite NORAD ID
const TLE_BASE_URL = "https://tle.ivanstanojevic.me/api/tle/"
// Default to ISS (ZARYA) NORAD ID
let CURRENT_NORAD_ID = "25544"
let CURRENT_SATELLITE_NAME = "ISS (ZARYA)"
let TLE_URL = `${TLE_BASE_URL}${CURRENT_NORAD_ID}`
// Default satellite altitude in meters - this will be updated based on TLE data
let SATELLITE_ALTITUDE = 400e3

$(document).ready(function () {
  "use strict";
  
  // Using OpenStreetMap Nominatim API for geocoding
  // See usage policy at: https://operations.osmfoundation.org/policies/nominatim/
  // Note: For production use with higher volumes, consider using a self-hosted instance
  const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
  
  // ---------------------
  // Initialize the globe
  // ----------------------

  // Create the primary globe
  let globe = new Globe("globe-canvas");
    
  // Add layers ordered by drawing order: first to last
  globe.addLayer(new WorldWind.BMNGLayer(), {
    category: "base"
  });
  globe.addLayer(new WorldWind.BMNGLandsatLayer(), {
    category: "base",
    enabled: false
  });
  globe.addLayerFromWms("https://tiles.maps.eox.at/wms", "osm", {
    category: "base",
    enabled: false
  });
  globe.addLayerFromWms("https://tiles.maps.eox.at/wms", "overlay", {
    category: "overlay",
    displayName: "OpenStreetMap overlay by EOX",
    enabled: false,
    opacity: 0.80
  });

  globe.addLayer(new WorldWind.CoordinatesDisplayLayer(globe.wwd), {
    category: "setting"
  });
  
  // View Controls layer removed
  
  globe.addLayer(new WorldWind.CompassLayer(), {
    category: "setting",
    enabled: false
  });
  globe.addLayer(new WorldWind.StarFieldLayer(), {
    category: "setting",
    enabled: true,
    displayName: "Stars"
  });
  globe.addLayer(new WorldWind.AtmosphereLayer(), {
    category: "setting",
    enabled: true,
    time: new Date()//'2022-10-01T06:00Z') // activates day/night mode
  });
  // globe.addLayer(new WorldWind.ShowTessellationLayer(), {
  //   category: "debug",
  //   enabled: false
  // });

  // Add Earth rotation animation
  // This rotates the Earth at a realistic speed (one rotation per day)
  let isEarthRotating = true;
  const rotationSpeed = 0.0025; // degrees per frame (adjusted for realistic rotation)
  
  // Start the rotation animation
  function startEarthRotation() {
    if (!globe.wwd.frameStatistics) {
      globe.wwd.frameStatistics = {frameTime: 0};
    }
    
    // Use requestAnimationFrame for smooth animation
    function animateRotation() {
      if (isEarthRotating) {
        // Get the current view
        let navigator = globe.wwd.navigator;
        
        // Rotate the view around the Y-axis (Earth's rotation axis)
        // This shifts the view's longitude
        navigator.heading = (navigator.heading + rotationSpeed) % 360;
        
        // Redraw the globe with the new heading
        globe.wwd.redraw();
        
        // Request the next animation frame
        requestAnimationFrame(animateRotation);
      }
    }
    
    // Start the animation
    animateRotation();
  }
  
  // Function to toggle Earth rotation on/off
  function toggleEarthRotation() {
    isEarthRotating = !isEarthRotating;
    if (isEarthRotating) {
      startEarthRotation();
    }
  }
  
  // Add the toggleEarthRotation function to the window object so it can be accessed globally
  window.toggleEarthRotation = toggleEarthRotation;
  
  // Start Earth rotation by default
  startEarthRotation();

  const orbitLayer = new WorldWind.RenderableLayer("Orbit")
  globe.addLayer(orbitLayer, {
    category: "data",
    enabled: true
  });
  const ISSLayer = new WorldWind.RenderableLayer("ISS");
  globe.addLayer(ISSLayer, {
    category: "data",
    enabled: true
  });
  
  // Create and assign the path's attributes.
  const orbitShapeAttrs = new WorldWind.ShapeAttributes(null);
  // orbitShapeAttrs.outlineColor = WorldWind.Color.BLUE;
  orbitShapeAttrs.interiorColor = new WorldWind.Color(1, 1, 1, 0.2);
  // orbitShapeAttrs.drawVerticals = orbit.extrude; //Draw verticals only when extruding.

  fetch(TLE_URL).then(response => response.json())
  .then((tleData) => {
    console.log(tleData)
    const { line1, line2 } = tleData
    const tleStr = `${line1}\n${line2}`

    tlejs.getGroundTracks({
      tle: tleStr,
      stepMS: 60e3,
      isLngLatFormat: false, 
    }).then(([ previous, current, next ]) => {
      const orbit = new WorldWind.Path(
        [...previous, ...current, ...next].map(([ lat, lon ]) => new WorldWind.Position(lat, lon, SATELLITE_ALTITUDE)),
        orbitShapeAttrs
      )
      orbit.pathType = WorldWind.GREAT_CIRCLE
      orbit.numSubSegments = 100
    
      orbit.altitudeMode = WorldWind.ABSOLUTE
      // orbit.followTerrain = true;
      orbit.extrude = true; // Make it a curtain.
      orbit.useSurfaceShapeFor2D = true; // Use a surface shape in 2D mode.
      
      // // Create and assign the path's highlight attributes.
      // const highlightAttributes = new WorldWind.ShapeAttributes(orbitShapeAttrs);
      // highlightAttributes.outlineColor = WorldWind.Color.RED;
      // highlightAttributes.interiorColor = new WorldWind.Color(1, 1, 1, 0.5);
      // orbit.highlightAttributes = highlightAttributes;
    
      // Add the path to a layer and the layer to the WorldWindow's layer list.
      orbitLayer.addRenderable(orbit)
      
      let { lat, lng } = tlejs.getLatLngObj(tleStr)

      var colladaLoader = new WorldWind.ColladaLoader(
        new WorldWind.Position(lat, lng, SATELLITE_ALTITUDE),
        { dirPath: 'images/' }
      )
      
      colladaLoader.load("ISS.dae", function (satelliteModel) {
        satelliteModel.scale = 2e6;
        ISSLayer.addRenderable(satelliteModel)

        globe.wwd.goTo(new WorldWind.Location(lat, lng));

        // Store the model reference globally for easy access
        window.currentSatelliteModel = satelliteModel;

        // Start position update interval
        window.positionUpdateInterval = setInterval(() => {
          let { lat, lng } = tlejs.getLatLngObj(tleStr)
          satelliteModel.position = new WorldWind.Position(lat, lng, SATELLITE_ALTITUDE)
          globe.refreshLayer(ISSLayer);
          
          // Update the status indicator with the current position
          const statusElement = document.getElementById('iss-status');
          if (statusElement) {
            statusElement.innerHTML = `${CURRENT_SATELLITE_NAME} Live Tracking: ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
          }
        }, 1e3);
      });
    })
  })
  
  /**
   * Update the tracked satellite
   * @param {String} noradId The NORAD ID of the satellite to track
   * @param {String} satelliteName The name of the satellite
   * @param {String} satelliteType The type of satellite (for model selection)
   * @param {Number} scale The scale factor for the 3D model
   */
  function updateTrackedSatellite(noradId, satelliteName, satelliteType = "space_station", scale = 2e6) {
    // Update global variables
    CURRENT_NORAD_ID = noradId;
    CURRENT_SATELLITE_NAME = satelliteName;
    TLE_URL = `${TLE_BASE_URL}${CURRENT_NORAD_ID}`;
    
    // Update the flyover TLE URL
    if (window.flyoverViewModel) {
      window.flyoverViewModel.tleUrl = TLE_URL;
    }
    
    // Clear existing position update interval
    if (window.positionUpdateInterval) {
      clearInterval(window.positionUpdateInterval);
    }
    
    // Clear existing orbit path
    orbitLayer.removeAllRenderables();
    
    // Clear the satellite model
    ISSLayer.removeAllRenderables();
    
    // Update status indicator label
    const statusElement = document.getElementById('iss-status');
    if (statusElement) {
      statusElement.innerHTML = `Loading ${satelliteName} data...`;
    }
    
    // Fetch new TLE data and update orbit/model
    fetch(TLE_URL).then(response => response.json())
    .then((tleData) => {
      console.log(tleData);
      const { line1, line2 } = tleData;
      const tleStr = `${line1}\n${line2}`;
      
      // Generate new orbit tracks
      tlejs.getGroundTracks({
        tle: tleStr,
        stepMS: 60e3,
        isLngLatFormat: false, 
      }).then(([ previous, current, next ]) => {
        // Create new orbit path
        const orbit = new WorldWind.Path(
          [...previous, ...current, ...next].map(([ lat, lon ]) => new WorldWind.Position(lat, lon, SATELLITE_ALTITUDE)),
          orbitShapeAttrs
        );
        orbit.pathType = WorldWind.GREAT_CIRCLE;
        orbit.numSubSegments = 100;
        orbit.altitudeMode = WorldWind.ABSOLUTE;
        orbit.extrude = true;
        orbit.useSurfaceShapeFor2D = true;
        
        // Add the orbit path to the layer
        orbitLayer.addRenderable(orbit);
        
        // Get current satellite position
        let { lat, lng } = tlejs.getLatLngObj(tleStr);
        
        // Get the appropriate model file for this satellite type
        const modelFile = getSatelliteModelByType(satelliteType);
        
        // Load the 3D model
        var colladaLoader = new WorldWind.ColladaLoader(
          new WorldWind.Position(lat, lng, SATELLITE_ALTITUDE),
          { dirPath: 'images/' }
        );
        
        colladaLoader.load(modelFile, function (satelliteModel) {
          satelliteModel.scale = scale;
          ISSLayer.addRenderable(satelliteModel);
          
          // Go to the satellite's current position
          globe.wwd.goTo(new WorldWind.Location(lat, lng));
          
          // Store the model reference globally
          window.currentSatelliteModel = satelliteModel;
          
          // Start new position update interval
          window.positionUpdateInterval = setInterval(() => {
            let { lat, lng } = tlejs.getLatLngObj(tleStr);
            satelliteModel.position = new WorldWind.Position(lat, lng, SATELLITE_ALTITUDE);
            globe.refreshLayer(ISSLayer);
            
            // Update the status indicator
            const statusElement = document.getElementById('iss-status');
            if (statusElement) {
              statusElement.innerHTML = `${satelliteName} Live Tracking: ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
            }
          }, 1e3);
        });
      });
    })
    .catch(error => {
      console.error("Error fetching satellite data:", error);
      const statusElement = document.getElementById('iss-status');
      if (statusElement) {
        statusElement.innerHTML = `Error loading satellite data`;
      }
      alert(`Error loading data for ${satelliteName}. Please try another satellite.`);
    });
  }

  /**
   * Get the appropriate 3D model file based on satellite type
   * @param {String} satelliteType The type of satellite
   * @returns {String} The filename of the 3D model to use
   */
  function getSatelliteModelByType(satelliteType) {
    // Map satellite types to model files
    const modelMap = {
      "space_station": "ISS.dae",
      "cubesat": "cubesat.dae",
      "communication": "communicationSat.dae",
      "earth_observation": "earthObservationSat.dae",
      "weather": "genericSat.dae", // Using generic for weather satellites
      "default": "genericSat.dae"
    };
    
    // Return the appropriate model or fallback to default
    return modelMap[satelliteType] || modelMap.default;
  }
  
  // -----------------------------------------------
  // Initialize Knockout view models and html views
  // -----------------------------------------------

  let layers = new LayersViewModel(globe);
  let settings = new SettingsViewModel(globe);
  // let markers = new MarkersViewModel(globe);
  // let tools = new ToolsViewModel(globe, markers);
  let preview = new SearchPreviewViewModel(globe, NOMINATIM_BASE_URL);
  // let search = new SearchViewModel(globe, preview.previewResults, NOMINATIM_BASE_URL);
  let flyover = new FlyoverViewModel(globe, TLE_URL);
  
  // Activate the Knockout bindings between our view models and the html
  ko.applyBindings(layers, document.getElementById('layers'));
  ko.applyBindings(settings, document.getElementById('settings'));
  // ko.applyBindings(markers, document.getElementById('markers'));
  // ko.applyBindings(tools, document.getElementById('tools'));
  // ko.applyBindings(search, document.getElementById('search'));
  ko.applyBindings(preview, document.getElementById('preview'));
  ko.applyBindings(flyover, document.getElementById('flyover'));
  
  // Initialize the satellite selector view model
  let satelliteSelector = new SatelliteViewModel(globe, updateTrackedSatellite);
  ko.applyBindings(satelliteSelector, document.getElementById('satellite-selector'));
  
  // Store the flyover view model in the window object so it can be accessed by the satellite selector
  window.flyoverViewModel = flyover;
  
  // ---------------------------------------------------------
  // Add UI event handlers to create a better user experience
  // ---------------------------------------------------------

  // Auto-collapse the main menu when its button items are clicked
  $('.navbar-collapse a[role="button"]').click(function () {
    $('.navbar-collapse').collapse('hide');
  });
  
  // Collapse card ancestors when the close icon is clicked
  $('.collapse .close').on('click', function () {
    $(this).closest('.collapse').collapse('hide');
  });
  
  // Nav button click handler - toggle the corresponding panel
  $('.nav-button').on('click', function() {
    const targetPanel = $(this).data('target');
    
    // Check if this panel is already open
    const isOpen = $(targetPanel).hasClass('show');
    
    // Remove active class from all buttons
    $('.nav-button').removeClass('active').attr('aria-expanded', 'false');
    
    if (!isOpen) {
      // If panel is not already open, mark this button as active
      $(this).addClass('active').attr('aria-expanded', 'true');
      
      // Open the panel using Bootstrap's collapse API
      $(targetPanel).collapse('show');
    } else {
      // If panel is already open, close it
      $(targetPanel).collapse('hide');
    }
  });
  
  // Update nav buttons when panels are shown/hidden via Bootstrap events
  $('.collapse').on('show.bs.collapse', function() {
    const buttonSelector = `[data-target="#${this.id}"]`;
    $(buttonSelector).addClass('active').attr('aria-expanded', 'true');
  });
  
  $('.collapse').on('hide.bs.collapse', function() {
    const buttonSelector = `[data-target="#${this.id}"]`;
    $(buttonSelector).removeClass('active').attr('aria-expanded', 'false');
  });
  
  // Ensure ESC key closes open panels
  $(document).on('keydown', function(e) {
    if (e.key === 'Escape') {
      $('.collapse.show').collapse('hide');
    }
  });
});
