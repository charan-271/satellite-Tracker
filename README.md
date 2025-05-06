# Satellite Tracker

A powerful web application for visualizing and tracking satellites in real-time 3D. Experience space exploration from your browser with this interactive globe-based tracker.

![Homepage](/images/homepage.png)

## Features

- **Multi-Satellite Tracking**: Monitor various satellites including:
  - International Space Station (ISS)
  - Communication satellites
  - Earth observation satellites
  - CubeSats

- **Intuitive User Interface**: Clean, responsive design with easy-to-use navigation panels

- **Flyover Predictions**: Calculate precise satellite pass times for any location with details on duration and maximum elevation

- **Customizable Visualization**: Choose from multiple map layers including:
  - Atmospheric visualization
  - Geographic boundaries
  - Star background
  - Day/night terminator
  - Custom markers

- **Real-time Position Updates**: Accurate satellite positioning using latest TLE data

## Interface Components

### Satellite Selector
Browse and select from our database of tracked satellites.
![Satellite Selector](/images/satellite%20selector.png)

### Layers Panel
Configure your viewing experience with various map overlays.
![Layers Panel](/images/layers.png)

### Flyover Predictions
Plan satellite observations by calculating upcoming passes for your location.
![Flyover Predictions](/images/satellite%20flyover%20predition.png)

### Settings
Adjust application parameters to optimize your experience.
![Settings](/images/settings.png)

## Technical Details

Built using modern web technologies:
- **NASA WorldWind**: 3D virtual globe engine for geospatial visualization
- **Satellite.js**: High-precision orbital mechanics calculations
- **Knockout.js**: MVVM pattern for responsive UI updates
- **ES6 JavaScript**: Modern code structure with modular components
- **Bootstrap 4**: Responsive design framework

## Data Sources

- Satellite TLE (Two-Line Element) data from https://tle.ivanstanojevic.me/
- 3D satellite models from NASA 3D Resources
- Geographic data from NASA WorldWind servers

## Acknowledgements

This project builds upon the [NASA WorldWind](https://worldwind.arc.nasa.gov/) virtual globe API and incorporates orbital calculation libraries [tle.js](https://github.com/davidcalhoun/tle.js) and [satellite.js](https://github.com/shashwatak/satellite-js).