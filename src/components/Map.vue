<template>
  <MglMap
    :accessToken="accessToken"
    :mapStyle="mapStyle"
    @load="onMapLoad"
    @click="onMapClick"
    :center="[-0.1, 51.5]"
    :zoom="9"
    :showZoom="true"
  >
    <MglNavigationControl :showCompass="false" position="top-right" />
    <MglMarker
      v-for="(stop, i) in filteredStops"
      :coordinates="stop.location"
      color="blue"
      :key="i"
    >
      <template slot="marker">
        <img src="bus-stop-small.png" width="20" height="20" />
      </template>
      <MglPopup>
        <div class="mapbox-popup">
          <strong>{{ stop.name }}</strong>
        </div>
      </MglPopup>
    </MglMarker>
  </MglMap>
</template>

<script>
import Mapbox from 'mapbox-gl';
import { MglMap, MglPopup, MglMarker, MglNavigationControl } from 'vue-mapbox';
import { bearing, point } from '@turf/turf';

import PapaParse from 'papaparse';
import axios from 'axios';
import OSPoint from 'ospoint';
import groupBy from 'lodash/groupBy';
import qs from 'query-string';

const colors = {
  '8': '#9f643c',
  '9': '#224584',
  '11': '#a9a6c3',
  '14': '#777776',
  '15': '#459b8e',
  '23': '#d986a9',
  '24': '#6dbedf',
  '25': '#8cc3b3',
  '38': '#783534',
  '43': '#a99171',
  '59': '#1a1919',
  '73': '#4da353',
  '74': '#c6317b',
  '88': '#c73734',
  '139': '#b4b5b4',
  '148': '#2b663a',
  '159': '#773466',
  '188': '#eabb97',
  '205': '#df8f44',
  '274': '#3a8abf',
  '390': '#90235b',
  '453': '#a6c454'
};

export default {
  components: {
    MglMap,
    MglPopup,
    MglMarker,
    MglNavigationControl
  },
  computed: {
    filteredStops() {
      return this.stops.filter(stop => stop.route === this.actualRoute);
    }
  },
  data() {
    return {
      accessToken:
        'pk.eyJ1Ijoiam9uYXNuaWVzdHJvaiIsImEiOiJjazN6bmt3dHowandwM21wMzcwc21vdjdxIn0.P496caPNw9SXrMl_GbzHdw', // your access token. Needed if you using Mapbox maps
      mapStyle: 'mapbox://styles/jonasniestroj/ck40ytrxe0otp1cqqyri422ly', // your map style
      stops: [],
      actualRoute: '9',
      routes: [],
      routesToRender: []
    };
  },
  async mounted() {
    const response = await axios.get('bus-sequences.csv');
    const stops = PapaParse.parse(response.data, { header: true }).data.filter(
      stop => colors[stop.Route] && stop.Run === '1'
    );

    stops.forEach(stop => {
      const point = new OSPoint(stop.Location_Northing, stop.Location_Easting);
      const latLong = point.toWGS84();
      if (!isNaN(latLong.longitude) && !isNaN(latLong.latitude)) {
        this.stops.push({
          name: stop.Stop_Name.toLowerCase(),
          route: stop.Route,
          location: [latLong.longitude, latLong.latitude]
        });
      }
    });

    const groupedStops = groupBy(stops, stop => stop.Route);

    const groupedStopsKeys = Object.keys(groupedStops);

    for (let i = 0; i < groupedStopsKeys.length; i++) {
      const stopGroupKey = groupedStopsKeys[i];
      const stopGroup = groupedStops[stopGroupKey];

      const filteredStops = stopGroup.filter(stop => stop.Run === '1');

      const config = {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      };

      let coordinatesArray = [];

      let count = 0;
      let index = 0;

      let firstCoordinate;
      let lastCoordinate;

      filteredStops.forEach(stop => {
        const point = new OSPoint(stop.Location_Northing, stop.Location_Easting);
        const latLong = point.toWGS84();
        if (!isNaN(latLong.longitude) && !isNaN(latLong.latitude)) {
          if (!coordinatesArray[index]) {
            coordinatesArray[index] = '';
            firstCoordinate = latLong;
          }
          coordinatesArray[index] += latLong.longitude + ',' + latLong.latitude + ';';
          count++;
          if (count % 20 === 0 && count !== filteredStops.length) {
            index++;
            if (!coordinatesArray[index]) {
              coordinatesArray[index] = '';
            }
            coordinatesArray[index] += latLong.longitude + ',' + latLong.latitude + ';';
          }
          if (count === filteredStops.length) {
            lastCoordinate = latLong;
          }
        }
      });

      const promises = [];

      coordinatesArray.forEach(coordinates => {
        const requestBody = {
          geometries: 'geojson',
          coordinates: coordinates.substring(0, coordinates.length - 1)
        };

        promises.push(
          axios.post(
            'https://api.mapbox.com/directions/v5/mapbox/driving?access_token=pk.eyJ1Ijoiam9uYXNuaWVzdHJvaiIsImEiOiJjazN6bmt3dHowandwM21wMzcwc21vdjdxIn0.P496caPNw9SXrMl_GbzHdw',
            qs.stringify(requestBody),
            config
          )
        );
      });

      const responses = await Promise.all(promises);
      const coordinates = [];
      responses.forEach(response => {
        if (response.data.routes.length > 0) {
          coordinates.push(...response.data.routes[0].geometry.coordinates);
        }
      });
      if (coordinates.length > 0) {
        const route = {
          route: stopGroupKey,
          coordinates
        };

        this.routes.push(route);
        this.renderRoute(route);
      }
    }
  },
  methods: {
    async onMapLoad(event) {
      this.mapbox = event.map;

      this.mapbox.loadImage('bus-blue.png', (error, image) => {
        if (error) throw error;
        this.mapbox.addImage('bus', image);
      });

      const asyncActions = event.component.actions;

      this.mapbox.flyTo({
        center: [-0.1, 51.5],
        zoom: 12,
        speed: 0.7
      });
    },
    renderRoute(route) {
      if (!this.mapbox) {
        this.routesToRender.push(route);
      } else {
        this.mapbox.addLayer({
          id: 'route-' + route.route,
          type: 'line',
          source: {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                coordinates: route.coordinates,
                type: 'LineString'
              }
            }
          },
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': colors[route.route],
            'line-width': 4
          }
        });
      }
    },
    renderRoutes() {
      this.routes.forEach(route => {
        if (this.mapbox.getLayer('route-' + route.route)) {
          this.mapbox.removeLayer('route-' + route.route);
        }

        this.renderRoute(route);
      });
    },
    startBus() {
      const startPoint = [];

      let routeNine;

      this.routes.forEach(route => {
        if (route.route === this.actualRoute) {
          routeNine = route;
          startPoint.push(route.coordinates[0].longitude);
          startPoint.push(route.coordinates[0].latitude);
        }
      });

      var route = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: routeNine.coordinates
            }
          }
        ]
      };

      var busPoint = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: startPoint
            }
          }
        ]
      };

      this.mapbox.addSource('point', {
        type: 'geojson',
        data: busPoint
      });

      this.mapbox.addLayer({
        id: 'point',
        source: 'point',
        type: 'symbol',
        layout: {
          'icon-image': 'bus',
          'icon-rotate': ['get', 'bearing'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });

      const steps = route.features[0].geometry.coordinates.length - 1;

      let counter = 0;

      const animate = () => {
        busPoint.features[0].geometry.coordinates = route.features[0].geometry.coordinates[counter];

        /*busPoint.features[0].properties.bearing = bearing(
          point(route.features[0].geometry.coordinates[counter >= steps ? counter - 1 : counter]),
          point(route.features[0].geometry.coordinates[counter >= steps ? counter : counter + 1])
        );*/

        // Update the source with this new data.
        this.mapbox.getSource('point').setData(busPoint);

        // Request the next frame of animation so long the end has not been reached.
        if (counter < steps) {
          setTimeout(() => {
            requestAnimationFrame(animate);
          }, 500);
        }

        counter = counter + 1;
      };

      animate();
    },
    toggleMapstyle() {
      if (this.mapStyle !== 'mapbox://styles/jonasniestroj/ck40ytrxe0otp1cqqyri422ly') {
        this.mapStyle = 'mapbox://styles/jonasniestroj/ck40ytrxe0otp1cqqyri422ly';
      } else {
        this.mapStyle = 'mapbox://styles/mapbox/streets-v11';
      }
      setTimeout(() => {
        this.renderRoutes();
      }, 500);
    },
    onMapClick(event) {
      const bbox = [
        [event.mapboxEvent.point.x - 5, event.mapboxEvent.point.y - 5],
        [event.mapboxEvent.point.x + 5, event.mapboxEvent.point.y + 5]
      ];
      const features = this.mapbox.queryRenderedFeatures(bbox);
      features.forEach(feature => {
        if (feature.source.startsWith('route-')) {
          const routeNumber = feature.source.split('-')[1];
          this.actualRoute = routeNumber;
        }
      });
    }
  },
  watch: {
    mapbox(newValue) {
      if (newValue) {
        this.routesToRender.forEach(route => {
          this.renderRoute(route);
        });
        this.routesToRender = [];
      }
    }
  }
};
</script>

<style>
:root {
  --popup-bg: #1c3e94;
  --popup-color: white;
}

.mapboxgl-popup-content {
  padding: 1rem;
  padding-top: 2rem;
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  letter-spacing: 0.05em;
  font-size: 1rem;
  color: var(--popup-color);
  background: var(--popup-bg);
  text-transform: capitalize;
}

.mapboxgl-marker {
}

.mapboxgl-popup-tip {
  border-top-color: var(--popup-bg);
}

.mapboxgl-marker svg {
  height: 24px;
}

.mapboxgl-popup-close-button {
  color: var(--popup-color);
  background: transparent;
  font-size: 1.5rem;
  line-height: 1;
}

.mapboxgl-ctrl-group {
  border-radius: 0px;
}

.mapboxgl-ctrl-zoom-in {
  background-color: white;
  background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAQAAACROWYpAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QA/4ePzL8AAAAHdElNRQfjDAsEKxwrjaB2AAABNklEQVQ4y82Vv07CUBTGf19p6ggL7CQmdTImvAYrM2HyJXT3FZwaZzbTpyAhMjhAYsJKYGlHG8txqeVPtHhrSPzWc3/3+3p67r2KHuhzZYaTJObEPn2NbcbWDcbTjQ18Qnt5f75FDqTxyIVx5xlmgRMKIsDM8BzjHsj/qfAEoC0YjFxhoEUILEicnQ2a9IBVPTigAwQ1vvlrhyr9qdvn+VWAkVdHL+EIoEWzbNAHXdpAlzwqVilTSgLDb5xFSI9O4ZXTtmsQbGgU9TVTJrssJewVSasafFz1D2oLVnuxLwUQ81auykj3+RIeAiS7aYqgwQZYsqwz26IBVaf1fw4Jpy6YKjhjLcjqwSlTQVoPTpjwu9k+1gjOfJ6FlJ2yOJKRIQlFrxrbzByfGxXPTWwD7h2tQTYn/gR+iWG919pECAAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAxOS0xMi0xMVQwNDo0MzoyOC0wNTowMOcVgkgAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMTktMTItMTFUMDQ6NDM6MjgtMDU6MDCWSDr0AAAAAElFTkSuQmCC');
}

.mapboxgl-ctrl-zoom-out {
  border-top: 0px !important;
  background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAQAAACROWYpAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QA/4ePzL8AAAAHdElNRQfjDAsELDK4Gjt+AAAAxUlEQVQ4y+3VMWoCQRjF8f9blk2plVdYS8FrbOsBrLyE9l7Bag+wXdhTBCRbWOgNQqpNmS18NookqOEDCYQ41cDMj+/BMDyVSwqGNqElsaVOKVS5YR/DJBp5kpL79fN5hgLSrHgy88TYWYiCyLBNEoz7NfsD/wucnjYlQJ8e2Y3bHR+0MP2OAZEzZsC1HybeWfNyPr9PbMDsePsxti/gKUBLG5n8R9/5gX8VC6kj1jamQxIqN6rcOFg3OtZN7QmL4GiQt9QHoxI6Q4U6jWsAAAAldEVYdGRhdGU6Y3JlYXRlADIwMTktMTItMTFUMDQ6NDQ6NTAtMDU6MDA8495PAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDE5LTEyLTExVDA0OjQ0OjUwLTA1OjAwTb5m8wAAAABJRU5ErkJggg==');
}
</style>
