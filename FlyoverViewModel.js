
export default class FlyoverViewModel {
  /**
   * Define the view model for the Satellite Flyover Prediction feature.
   * @param {Globe} globe The globe model
   * @param {String} tleUrl URL for fetching satellite TLE data
   * @param {String} satelliteName Name of the satellite to track
   * @returns {FlyoverViewModel}
   */
  constructor(globe, tleUrl, satelliteName = "ISS") {
    var self = this;
    this.globe = globe;
    this.tleUrl = tleUrl;
    this.tleData = null;
    this.satelliteName = ko.observable(satelliteName);
    
    // Create a layer for the flyover paths
    this.flyoverPathLayer = new WorldWind.RenderableLayer("Flyover Paths");
    this.globe.wwd.addLayer(this.flyoverPathLayer);
    this.flyoverPathLayer.enabled = true;
    
    // Create a layer for the observer location marker
    this.observerLocationLayer = new WorldWind.RenderableLayer("Observer Location");
    this.globe.wwd.addLayer(this.observerLocationLayer);
    this.observerLocationLayer.enabled = true;
    
    // Observable properties for the view
    this.latitude = ko.observable("");
    this.longitude = ko.observable("");
    this.days = ko.observable(3);
    this.isCalculating = ko.observable(false);
    this.flyoverPasses = ko.observableArray([]);
    
    /**
     * Get the user's current location using the browser's geolocation API
     */
    this.useCurrentLocation = function() {
      if (navigator.geolocation) {
        self.isCalculating(true);
        navigator.geolocation.getCurrentPosition(
          // Success callback
          function(position) {
            self.latitude(position.coords.latitude.toFixed(6));
            self.longitude(position.coords.longitude.toFixed(6));
            self.isCalculating(false);
          },
          // Error callback
          function(error) {
            console.error("Error getting location: ", error.message);
            self.isCalculating(false);
            alert("Couldn't get your location. Please enter it manually.");
          },
          // Options
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          }
        );
      } else {
        alert("Geolocation is not supported by this browser. Please enter your coordinates manually.");
      }
    };
    
    /**
     * Reset the view back to normal, showing the standard orbit trajectory
     */
    this.resetView = function() {
      // Restore the standard orbit trajectory
      const orbitLayer = self.globe.wwd.layers.find(layer => layer.displayName === "Orbit");
      if (orbitLayer && orbitLayer._originalEnabledState !== undefined) {
        orbitLayer.enabled = orbitLayer._originalEnabledState;
        delete orbitLayer._originalEnabledState;
      }
      
      // Clear the flyover path
      self.flyoverPathLayer.removeAllRenderables();
      
      // Clear the observer location
      self.observerLocationLayer.removeAllRenderables();
      
      // Find and clear the pass markers layer
      const passMarkersLayer = self.globe.wwd.layers.find(layer => layer.displayName === "Pass Markers");
      if (passMarkersLayer) {
        passMarkersLayer.removeAllRenderables();
      }
      
      // Refresh the view
      self.globe.wwd.redraw();
    };
    
    /**
     * Calculate ISS flyovers for the specified location
     */
    this.calculateFlyovers = function() {
      let lat = parseFloat(self.latitude());
      let lon = parseFloat(self.longitude());
      let numDays = parseInt(self.days());
      
      if (isNaN(lat) || isNaN(lon)) {
        alert("Please enter valid latitude and longitude values.");
        return;
      }
      
      if (lat < -90 || lat > 90) {
        alert("Latitude must be between -90 and 90 degrees.");
        return;
      }
      
      if (lon < -180 || lon > 180) {
        alert("Longitude must be between -180 and 180 degrees.");
        return;
      }
      
      self.isCalculating(true);
      self.flyoverPasses.removeAll();
      
      // Fetch the latest TLE data
      self.fetchTle().then(function(tleData) {
        // Calculate flyover passes
        self.calculatePasses(lat, lon, numDays, tleData).then(function(passes) {
          // Update the observable array with the passes
          passes.forEach(function(pass) {
            self.flyoverPasses.push(pass);
          });
          self.isCalculating(false);
        }).catch(function(error) {
          console.error("Error calculating passes:", error);
          self.isCalculating(false);
          alert("Error calculating passes. Please try again.");
        });
      }).catch(function(error) {
        console.error("Error fetching TLE data:", error);
        self.isCalculating(false);
        alert("Error fetching ISS data. Please try again.");
      });
    };
    
    /**
     * Fetch the latest TLE data for the ISS
     * @returns {Promise} A promise that resolves with the TLE data
     */
    this.fetchTle = function() {
      return new Promise(function(resolve, reject) {
        fetch(self.tleUrl)
          .then(response => response.json())
          .then(data => {
            self.tleData = data;
            resolve(data);
          })
          .catch(error => {
            reject(error);
          });
      });
    };
    
    /**
     * Calculate visible ISS passes for the given location
     * @param {Number} lat Latitude in degrees
     * @param {Number} lon Longitude in degrees
     * @param {Number} days Number of days to predict
     * @param {Object} tleData TLE data object
     * @returns {Promise} A promise that resolves with an array of pass objects
     */
    this.calculatePasses = function(lat, lon, days, tleData) {
      return new Promise(function(resolve, reject) {
        try {
          const { line1, line2 } = tleData;
          const tleStr = `${line1}\n${line2}`;
          
          // Calculate passes using tle.js and satellite.js
          const startTime = new Date();
          const endTime = new Date(startTime.getTime() + (days * 24 * 60 * 60 * 1000)); // days in ms
          
          const observerGd = {
            longitude: lon,
            latitude: lat,
            height: 0.370 // km above sea level (assumed, modify as needed)
          };
          
          console.log('Observer location:', observerGd);
          console.log('TLE data:', tleStr);
          console.log('Start time:', startTime);
          console.log('End time:', endTime);
          
          try {
            // Get visible ISS passes - using try/catch here to better handle errors
            const passes = tlejs.getVisiblePasses({
              tle: tleStr,
              startDate: startTime,
              endDate: endTime,
              observerGd: observerGd,
              minElevation: 10, // minimum elevation for visibility (degrees)
              maxTimes: 20 // max number of passes to return
            });
            
            console.log('Calculated passes:', passes);
            
            // Fall back to a basic calculation method if getVisiblePasses doesn't work
            if (!passes || !Array.isArray(passes) || passes.length === 0) {
              // If we got no valid passes data, try an alternative approach
              console.log('No passes found with getVisiblePasses, trying fallback method');
              return self.calculatePassesFallback(lat, lon, days, tleStr, resolve, reject);
            }
            
            // Format the passes for display
            const formattedPasses = passes.map(function(pass) {
              return {
                startDate: new Date(pass.startDate).toLocaleString(),
                startTimestamp: pass.startDate,
                duration: (pass.duration / 60).toFixed(1), // convert to minutes
                maxElevation: Math.round(pass.maxElevation),
                startAzimuth: Math.round(pass.startAzimuth),
                endAzimuth: Math.round(pass.endAzimuth),
                pass: pass // Store the original pass data
              };
            });
            
            resolve(formattedPasses);
          } catch (innerError) {
            console.error('Error in getVisiblePasses:', innerError);
            // Fall back to a simpler calculation method
            self.calculatePassesFallback(lat, lon, days, tleStr, resolve, reject);
          }
        } catch (error) {
          console.error('Error in calculatePasses:', error);
          reject(error);
        }
      });
    };
    
    /**
     * Fallback method to calculate ISS passes when the primary method fails
     * @param {Number} lat Latitude in degrees
     * @param {Number} lon Longitude in degrees
     * @param {Number} days Number of days to predict
     * @param {String} tleStr TLE data string
     * @param {Function} resolve Promise resolve function
     * @param {Function} reject Promise reject function
     */
    this.calculatePassesFallback = function(lat, lon, days, tleStr, resolve, reject) {
      try {
        console.log('Using fallback pass calculation method');
        
        // Manual calculation approach
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + (days * 24 * 60 * 60 * 1000));
        const stepMinutes = 5; // Check position every 5 minutes
        const totalMinutes = days * 24 * 60;
        const steps = totalMinutes / stepMinutes;
        const manualPasses = [];
        
        // Track potential passes
        let isVisible = false;
        let currentPass = null;
        
        // Observer position (in radians for calculations)
        const observerLat = lat * (Math.PI / 180);
        const observerLon = lon * (Math.PI / 180);
        
        // Loop through time steps to find when ISS is visible
        for (let i = 0; i <= steps; i++) {
          const checkTime = new Date(startTime.getTime() + (i * stepMinutes * 60 * 1000));
          
          try {
            // Get ISS position at this time
            const position = tlejs.getLatLngObj(tleStr, checkTime);
            const elevation = self.calculateElevation(
              observerLat,
              observerLon,
              position.lat * (Math.PI / 180),
              position.lng * (Math.PI / 180)
            );
            
            // ISS is considered visible when it's at least 10 degrees above horizon
            const isCurrentlyVisible = elevation >= 10;
            
            // Start of a new pass
            if (isCurrentlyVisible && !isVisible) {
              isVisible = true;
              currentPass = {
                startDate: checkTime.getTime(),
                maxElevation: elevation,
                maxElevationTime: checkTime.getTime(),
                duration: stepMinutes * 60 // Initial duration in seconds
              };
            }
            // During a pass, update maximum elevation
            else if (isCurrentlyVisible && isVisible) {
              currentPass.duration += stepMinutes * 60;
              if (elevation > currentPass.maxElevation) {
                currentPass.maxElevation = elevation;
                currentPass.maxElevationTime = checkTime.getTime();
              }
            }
            // End of a pass
            else if (!isCurrentlyVisible && isVisible) {
              isVisible = false;
              manualPasses.push(currentPass);
              currentPass = null;
            }
          } catch (timeError) {
            console.warn('Error calculating position at time:', checkTime, timeError);
            // Continue with the next time step
          }
        }
        
        // Add the last pass if we're still in one
        if (currentPass !== null) {
          manualPasses.push(currentPass);
        }
        
        // Format passes for display
        const formattedPasses = manualPasses.map(function(pass) {
          return {
            startDate: new Date(pass.startDate).toLocaleString(),
            startTimestamp: pass.startDate,
            duration: (pass.duration / 60).toFixed(1), // convert to minutes
            maxElevation: Math.round(pass.maxElevation),
            // Estimate start/end azimuths (simplified)
            startAzimuth: 0, // These would require more complex calculation
            endAzimuth: 0,
            pass: pass // Store the original pass data
          };
        });
        
        console.log('Fallback calculation found passes:', formattedPasses);
        resolve(formattedPasses);
      } catch (fallbackError) {
        console.error('Error in fallback calculation:', fallbackError);
        reject(fallbackError);
      }
    };
    
    /**
     * Calculate the elevation angle of the satellite from the observer's position
     * @param {Number} observerLat Observer's latitude in radians
     * @param {Number} observerLon Observer's longitude in radians
     * @param {Number} satelliteLat Satellite's latitude in radians
     * @param {Number} satelliteLon Satellite's longitude in radians
     * @returns {Number} Elevation angle in degrees
     */
    this.calculateElevation = function(observerLat, observerLon, satelliteLat, satelliteLon) {
      // Earth radius in km
      const earthRadius = 6371;
      // ISS altitude in km
      const issAltitude = 400;
      
      // Calculate the great circle distance between observer and the satellite's nadir point
      const centralAngle = Math.acos(
        Math.sin(observerLat) * Math.sin(satelliteLat) +
        Math.cos(observerLat) * Math.cos(satelliteLat) * Math.cos(observerLon - satelliteLon)
      );
      
      // Calculate the elevation angle
      const elevationRadians = Math.atan2(
        Math.cos(centralAngle) * earthRadius + issAltitude - earthRadius,
        Math.sin(centralAngle) * earthRadius
      );
      
      // Convert to degrees
      return elevationRadians * (180 / Math.PI);
    };
    
    /**
     * Go to the ISS position at the time of a specific pass
     * @param {Object} pass Pass data object
     */
    this.goToPassTime = function(pass) {
      if (!self.tleData) {
        alert("TLE data not available. Please calculate flyovers first.");
        return;
      }
      
      const { line1, line2 } = self.tleData;
      const tleStr = `${line1}\n${line2}`;
      
      // Set the globe time to the pass start time
      const passTime = new Date(pass.startTimestamp);
      console.log("Going to pass time:", passTime, "Pass data:", pass);
      
      try {
        // Calculate ISS position at the pass time using getLatLngObj instead of getLatLonAlt
        const position = tlejs.getLatLngObj(tleStr, passTime);
        
        // Go to that position on the globe
        self.globe.wwd.goTo(new WorldWind.Location(position.lat, position.lng));
        
        // Create a marker to show the ISS position at this time
        self.addPassPositionMarker(position.lat, position.lng, passTime);
        
        // Show the predicted path for this flyover
        self.showFlyoverPath(pass, tleStr);
        
        // Add a marker for the observer location
        self.showObserverLocation();
      } catch (error) {
        console.error("Error showing ISS position:", error);
        alert("Could not show ISS position at the selected time.");
      }
    };
    
    /**
     * Add a temporary marker showing the ISS position at a specific pass time
     * @param {Number} lat Latitude
     * @param {Number} lng Longitude
     * @param {Date} passTime The time of the pass
     */
    this.addPassPositionMarker = function(lat, lng, passTime) {
      // Find or create a layer for pass markers
      let passMarkersLayer = self.globe.wwd.layers.find(layer => layer.displayName === "Pass Markers");
      if (!passMarkersLayer) {
        passMarkersLayer = new WorldWind.RenderableLayer("Pass Markers");
        self.globe.wwd.addLayer(passMarkersLayer);
      }
      
      // Clear previous markers
      passMarkersLayer.removeAllRenderables();
      
      // Create a highlighted placemark
      const placemarkAttributes = new WorldWind.PlacemarkAttributes(null);
      placemarkAttributes.imageSource = "images/ISS.png";
      placemarkAttributes.imageScale = 0.5;
      placemarkAttributes.imageOffset = new WorldWind.Offset(
        WorldWind.OFFSET_FRACTION, 0.5,
        WorldWind.OFFSET_FRACTION, 0.5
      );
      placemarkAttributes.imageColor = WorldWind.Color.WHITE;
      placemarkAttributes.labelAttributes.color = WorldWind.Color.YELLOW;
      placemarkAttributes.labelAttributes.offset = new WorldWind.Offset(
        WorldWind.OFFSET_FRACTION, 0.5,
        WorldWind.OFFSET_FRACTION, 1.5
      );
      placemarkAttributes.drawLeaderLine = true;
      placemarkAttributes.leaderLineAttributes.outlineColor = WorldWind.Color.RED;
      
      const highlightAttributes = new WorldWind.PlacemarkAttributes(placemarkAttributes);
      highlightAttributes.imageScale = 0.7;
      
      // Create placemark at the pass location
      const placemark = new WorldWind.Placemark(
        new WorldWind.Position(lat, lng, 400000), // ISS altitude (400 km)
        true, // Draw the placemark using leader line to surface
        null // Use the attributes defined below
      );
      
      placemark.label = `ISS at ${passTime.toLocaleTimeString()}`;
      placemark.altitudeMode = WorldWind.ABSOLUTE;
      placemark.attributes = placemarkAttributes;
      placemark.highlightAttributes = highlightAttributes;
      
      // Add the placemark to the layer
      passMarkersLayer.addRenderable(placemark);
      
      // Ensure the layer is enabled
      passMarkersLayer.enabled = true;
      
      // Refresh the layer
      self.globe.wwd.redraw();
    };
    
    /**
     * Show the predicted path of the ISS during a specific flyover
     * @param {Object} pass The flyover pass data
     * @param {String} tleStr The TLE data string
     */
    this.showFlyoverPath = function(pass, tleStr) {
      // Clear any existing paths
      self.flyoverPathLayer.removeAllRenderables();
      
      // Hide the standard orbit trajectory
      const orbitLayer = self.globe.wwd.layers.find(layer => layer.displayName === "Orbit");
      if (orbitLayer) {
        // Store original enabled state if not already stored
        if (orbitLayer._originalEnabledState === undefined) {
          orbitLayer._originalEnabledState = orbitLayer.enabled;
        }
        orbitLayer.enabled = false;
      }
      
      // Get the start and estimated end time of the pass
      const startTime = new Date(pass.startTimestamp);
      const durationMinutes = parseFloat(pass.duration);
      const endTime = new Date(startTime.getTime() + (durationMinutes * 60 * 1000));
      
      // Calculate extended timeframe for a longer trajectory
      // Show path for 30 minutes before and after the actual visible pass
      const extendedStartTime = new Date(startTime.getTime() - (30 * 60 * 1000)); // 30 minutes before visible start
      const extendedEndTime = new Date(endTime.getTime() + (30 * 60 * 1000)); // 30 minutes after visible end
      
      // Calculate positions at regular intervals during the extended pass
      const numSteps = 120; // Increased number of points for smoother and longer path
      const timeStep = (extendedEndTime - extendedStartTime) / numSteps;
      const positions = [];
      
      for (let i = 0; i <= numSteps; i++) {
        const time = new Date(extendedStartTime.getTime() + (i * timeStep));
        try {
          const position = tlejs.getLatLngObj(tleStr, time);
          positions.push(new WorldWind.Position(position.lat, position.lng, 400000)); // 400 km altitude
        } catch (error) {
          console.warn("Error calculating position for flyover path:", error);
        }
      }
      
      // Create a path with the calculated positions
      if (positions.length > 1) {
        // Create path attributes with a distinctive look
        const pathAttributes = new WorldWind.ShapeAttributes(null);
        pathAttributes.outlineColor = WorldWind.Color.YELLOW;
        pathAttributes.outlineWidth = 3;
        pathAttributes.drawOutline = true;
        pathAttributes.drawInterior = false;
        
        // Create a highlighted version of the attributes
        const highlightAttributes = new WorldWind.ShapeAttributes(pathAttributes);
        highlightAttributes.outlineColor = WorldWind.Color.WHITE;
        highlightAttributes.outlineWidth = 5;
        
        // Create the path
        const path = new WorldWind.Path(positions, pathAttributes);
        path.altitudeMode = WorldWind.ABSOLUTE;
        path.pathType = WorldWind.GREAT_CIRCLE; // Use great circle interpolation
        path.numSubSegments = 100; // Increased for smoother path
        path.highlightAttributes = highlightAttributes;
        
        // Add the path to the layer
        self.flyoverPathLayer.addRenderable(path);
        
        // Add markers for visible pass start and end points (not the extended path)
        // This helps distinguish the actual visible portion
        this.addVisiblePassMarkers(startTime, endTime, tleStr);
        
        // Add direction arrows along the path
        this.addDirectionArrows(positions);
        
        // Refresh the layer
        self.globe.wwd.redraw();
      }
    };
    
    /**
     * Add direction arrows along the path to show the direction of ISS movement
     * @param {Array} positions Array of WorldWind.Position objects representing the path
     */
    this.addDirectionArrows = function(positions) {
      if (positions.length < 10) return; // Need enough positions to add arrows
      
      // Add arrows at regular intervals along the path
      // We'll add 5 arrows total
      const numArrows = 5;
      const interval = Math.floor(positions.length / (numArrows + 1));
      
      for (let i = 1; i <= numArrows; i++) {
        const index = i * interval;
        if (index >= positions.length - 1) continue;
        
        // Get current position and next position to determine direction
        const currentPos = positions[index];
        const nextPos = positions[index + 1];
        
        // Calculate heading between the two positions
        const heading = this.calculateHeading(
          currentPos.latitude, currentPos.longitude,
          nextPos.latitude, nextPos.longitude
        );
        
        // Create an arrow marker at this position
        this.createDirectionArrow(currentPos, heading);
      }
    };
    
    /**
     * Calculate the heading (azimuth) between two points
     * @param {Number} lat1 Starting latitude in degrees
     * @param {Number} lon1 Starting longitude in degrees
     * @param {Number} lat2 Ending latitude in degrees
     * @param {Number} lon2 Ending longitude in degrees
     * @returns {Number} Heading in degrees (0-360)
     */
    this.calculateHeading = function(lat1, lon1, lat2, lon2) {
      // Convert to radians
      const lat1Rad = lat1 * (Math.PI / 180);
      const lon1Rad = lon1 * (Math.PI / 180);
      const lat2Rad = lat2 * (Math.PI / 180);
      const lon2Rad = lon2 * (Math.PI / 180);
      
      // Calculate heading
      const y = Math.sin(lon2Rad - lon1Rad) * Math.cos(lat2Rad);
      const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
                Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lon2Rad - lon1Rad);
      let heading = Math.atan2(y, x) * (180 / Math.PI);
      
      // Normalize to 0-360
      heading = (heading + 360) % 360;
      
      return heading;
    };
    
    /**
     * Create an arrow marker at the specified position pointing in the specified heading
     * @param {WorldWind.Position} position The position for the arrow
     * @param {Number} heading The heading in degrees
     */
    this.createDirectionArrow = function(position, heading) {
      // Create a triangle shape pointing in the direction of movement
      
      // Create a placemark attributes for the arrow
      const arrowAttributes = new WorldWind.PlacemarkAttributes(null);
      
      // Use a colored triangle as an arrow
      arrowAttributes.imageSource = this.createArrowImage(heading);
      arrowAttributes.imageScale = 0.5;
      arrowAttributes.imageOffset = new WorldWind.Offset(
        WorldWind.OFFSET_FRACTION, 0.5,
        WorldWind.OFFSET_FRACTION, 0.5
      );
      
      // Create the placemark at the position
      const arrow = new WorldWind.Placemark(
        new WorldWind.Position(position.latitude, position.longitude, position.altitude),
        false
      );
      arrow.altitudeMode = WorldWind.ABSOLUTE;
      arrow.attributes = arrowAttributes;
      
      // Add to the flyover path layer
      self.flyoverPathLayer.addRenderable(arrow);
    };
    
    /**
     * Create an arrow image pointing in the specified direction
     * @param {Number} heading The heading in degrees
     * @returns {String} Data URL of the arrow image
     */
    this.createArrowImage = function(heading) {
      // Create a canvas to draw the arrow
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      
      // Move to center of canvas
      ctx.translate(32, 32);
      
      // Rotate to match heading (subtract 90 to point arrow in correct direction)
      ctx.rotate((heading - 90) * Math.PI / 180);
      
      // Draw a triangle pointing right (which will be rotated to match heading)
      ctx.beginPath();
      ctx.moveTo(16, 0);  // Tip of the arrow
      ctx.lineTo(-8, -8); // Left corner
      ctx.lineTo(-4, 0);  // Indentation
      ctx.lineTo(-8, 8);  // Right corner
      ctx.closePath();
      
      // Fill with a bright color that stands out
      ctx.fillStyle = 'rgba(255, 100, 0, 0.9)'; // Bright orange, slightly transparent
      ctx.fill();
      
      // Add an outline
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Convert to data URL
      return canvas.toDataURL();
    };
    
    /**
     * Add markers for the start and end points of the visible flyover portion
     * @param {Date} startTime The start time of the visible flyover
     * @param {Date} endTime The end time of the visible flyover
     * @param {String} tleStr The TLE data string
     */
    this.addVisiblePassMarkers = function(startTime, endTime, tleStr) {
      try {
        // Get positions at visible start and end times
        const startPosition = tlejs.getLatLngObj(tleStr, startTime);
        const endPosition = tlejs.getLatLngObj(tleStr, endTime);
        
        // Create attributes for the start marker
        const startAttributes = new WorldWind.PlacemarkAttributes(null);
        startAttributes.imageSource = null; // No image, just a point
        startAttributes.imageColor = new WorldWind.Color(0, 1, 0, 1); // Green for start
        startAttributes.labelAttributes.color = WorldWind.Color.GREEN;
        startAttributes.labelAttributes.offset = new WorldWind.Offset(
          WorldWind.OFFSET_FRACTION, 0.5,
          WorldWind.OFFSET_FRACTION, 1.0
        );
        startAttributes.drawLeaderLine = true;
        startAttributes.leaderLineAttributes.outlineColor = WorldWind.Color.GREEN;
        
        // Create attributes for the end marker
        const endAttributes = new WorldWind.PlacemarkAttributes(null);
        endAttributes.imageSource = null; // No image, just a point
        endAttributes.imageColor = new WorldWind.Color(1, 0, 0, 1); // Red for end
        endAttributes.labelAttributes.color = WorldWind.Color.RED;
        endAttributes.labelAttributes.offset = new WorldWind.Offset(
          WorldWind.OFFSET_FRACTION, 0.5,
          WorldWind.OFFSET_FRACTION, 1.0
        );
        endAttributes.drawLeaderLine = true;
        endAttributes.leaderLineAttributes.outlineColor = WorldWind.Color.RED;
        
        // Create start marker
        const startMarker = new WorldWind.Placemark(
          new WorldWind.Position(startPosition.lat, startPosition.lng, 400000),
          true
        );
        startMarker.label = `Visible from: ${startTime.toLocaleTimeString()}`;
        startMarker.altitudeMode = WorldWind.ABSOLUTE;
        startMarker.attributes = startAttributes;
        
        // Create end marker
        const endMarker = new WorldWind.Placemark(
          new WorldWind.Position(endPosition.lat, endPosition.lng, 400000),
          true
        );
        endMarker.label = `Visible until: ${endTime.toLocaleTimeString()}`;
        endMarker.altitudeMode = WorldWind.ABSOLUTE;
        endMarker.attributes = endAttributes;
        
        // Add markers to the layer
        self.flyoverPathLayer.addRenderable(startMarker);
        self.flyoverPathLayer.addRenderable(endMarker);
      } catch (error) {
        console.warn("Error adding visible pass markers:", error);
      }
    };
    
    /**
     * Show a marker at the observer's location (the user's position on Earth)
     */
    this.showObserverLocation = function() {
      // Clear any existing markers
      self.observerLocationLayer.removeAllRenderables();
      
      // Get the user's location
      const lat = parseFloat(self.latitude());
      const lon = parseFloat(self.longitude());
      
      if (isNaN(lat) || isNaN(lon)) {
        console.warn("Cannot show observer location: Invalid coordinates");
        return;
      }
      
      // Create attributes for the observer location marker
      const observerAttributes = new WorldWind.PlacemarkAttributes(null);
      observerAttributes.imageSource = "images/world.png"; // Use world icon for observer
      observerAttributes.imageScale = 0.5;
      observerAttributes.imageOffset = new WorldWind.Offset(
        WorldWind.OFFSET_FRACTION, 0.5,
        WorldWind.OFFSET_FRACTION, 0.5
      );
      observerAttributes.imageColor = WorldWind.Color.WHITE;
      observerAttributes.labelAttributes.color = WorldWind.Color.CYAN;
      observerAttributes.labelAttributes.offset = new WorldWind.Offset(
        WorldWind.OFFSET_FRACTION, 0.5,
        WorldWind.OFFSET_FRACTION, 1.5
      );
      
      // Create a highlighted version for mouseover
      const highlightAttributes = new WorldWind.PlacemarkAttributes(observerAttributes);
      highlightAttributes.imageScale = 0.6;
      highlightAttributes.imageColor = new WorldWind.Color(1, 1, 1, 1);
      
      // Create the observer placemark
      const observerPlacemark = new WorldWind.Placemark(
        new WorldWind.Position(lat, lon, 0), // Position at ground level
        true, // Draw leader line to surface
        null
      );
      
      // Set marker properties
      observerPlacemark.label = "Your Location";
      observerPlacemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
      observerPlacemark.attributes = observerAttributes;
      observerPlacemark.highlightAttributes = highlightAttributes;
      
      // Add a reference circle to show viewing area
      this.addViewingCircle(lat, lon);
      
      // Add the placemark to the layer
      self.observerLocationLayer.addRenderable(observerPlacemark);
      
      // Ensure the layer is enabled
      self.observerLocationLayer.enabled = true;
      
      // Refresh the layer
      self.globe.wwd.redraw();
    };
    
    /**
     * Add a circle around the observer's location to indicate approximate viewing area
     * @param {Number} lat Observer's latitude
     * @param {Number} lon Observer's longitude
     */
    this.addViewingCircle = function(lat, lon) {
      // Create a circle with ~500km radius (approximate viewing distance to horizon)
      const boundaries = [];
      const numPoints = 72; // Number of points to use when creating the circle
      const radius = 500000; // 500 km radius
      
      // Create circle points
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        const position = new WorldWind.Position(
          lat,
          lon,
          0
        );
        // Use WorldWind's location projection to create the circle
        const locationPoint = new WorldWind.Location(position.latitude, position.longitude);
        const azimuth = angle * (180 / Math.PI); // Convert to degrees
        const projectedLocation = WorldWind.Location.greatCircleLocation(
          locationPoint,
          azimuth,
          radius / 6371000, // Convert meters to radians (Earth radius is ~6371km)
          new WorldWind.Location(0, 0)
        );
        
        boundaries.push(new WorldWind.Position(projectedLocation.latitude, projectedLocation.longitude, 0));
      }
      
      // Close the circle
      boundaries.push(boundaries[0]);
      
      // Create circle attributes
      const circleAttributes = new WorldWind.ShapeAttributes(null);
      circleAttributes.outlineColor = new WorldWind.Color(0, 1, 1, 0.7); // Cyan, semi-transparent
      circleAttributes.outlineWidth = 2;
      circleAttributes.drawInterior = true;
      circleAttributes.interiorColor = new WorldWind.Color(0, 1, 1, 0.1); // Cyan, very transparent
      
      // Create the circle as a polygon
      const circle = new WorldWind.SurfacePolygon(boundaries, circleAttributes);
      
      // Add the circle to the observer location layer
      self.observerLocationLayer.addRenderable(circle);
    };
  }
}