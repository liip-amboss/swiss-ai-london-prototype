<template>
  <MglMap
    :accessToken="accessToken"
    :mapStyle="mapStyle"
    @load="onMapLoad"
    :center="[-0.1, 51.5]"
    :zoom="9"
  >
    <MglMarker v-for="(stop, i) in stops" :coordinates="stop.location" color="blue" :key="i">
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
import { MglMap, MglPopup, MglMarker } from 'vue-mapbox';
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
    MglMarker
  },
  data() {
    return {
      accessToken:
        'pk.eyJ1Ijoiam9uYXNuaWVzdHJvaiIsImEiOiJjazN6bmt3dHowandwM21wMzcwc21vdjdxIn0.P496caPNw9SXrMl_GbzHdw', // your access token. Needed if you using Mapbox maps
      mapStyle: 'mapbox://styles/jonasniestroj/ck40ytrxe0otp1cqqyri422ly', // your map style
      stops: [],
      routes: []
    };
  },
  mounted() {},
  methods: {
    async onMapLoad(event) {
      this.mapbox = event.map;
      const asyncActions = event.component.actions;

      const newParams = await asyncActions.flyTo({
        center: [-0.1, 51.5],
        zoom: 12,
        speed: 0.7
      });

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
          this.routes.push({
            route: stopGroupKey,
            coordinates
          });
        }
      }
      this.renderRoutes();
    },
    renderRoutes() {
      this.routes.forEach(route => {
        if (this.mapbox.getLayer('route-' + route.route))
          this.mapbox.removeLayer('route-' + route.route);
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
      });
    },
    startBus() {
      const startPoint = [
        this.routes[0].coordinates[0].longitude,
        this.routes[0].coordinates[0].latitude
      ];

      var route = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: this.routes[0].coordinates
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
          'icon-image': 'airport-15',
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

        busPoint.features[0].properties.bearing = bearing(
          point(route.features[0].geometry.coordinates[counter >= steps ? counter - 1 : counter]),
          point(route.features[0].geometry.coordinates[counter >= steps ? counter : counter + 1])
        );

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
    }
  }
};
</script>

<style>
:root {
  --popup-bg: blue;
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
</style>
