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
  '1': '#ff7e5f',
  '2': '#30bf60',
  '3': '#346fed',
  '4': '#e02636',
  '5': '#66faff'
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

      axios.get('stop-sequences-example.csv').then(response => {
        const stops = PapaParse.parse(response.data, { header: true });

        const groupedStops = groupBy(stops.data, stop => stop.Route);

        Object.keys(groupedStops).forEach(stopGroupKey => {
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

          Promise.all(promises).then(responses => {
            const coordinates = [];
            responses.forEach(response => {
              coordinates.push(...response.data.routes[0].geometry.coordinates);
            });
            if (coordinates.length > 0) {
              this.routes.push({
                route: stopGroupKey,
                coordinates
              });
            }

            event.map.addLayer({
              id: 'route-' + stopGroupKey,
              type: 'line',
              source: {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    coordinates: coordinates,
                    type: 'LineString'
                  }
                }
              },
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': colors[stopGroupKey],
                'line-width': 4
              }
            });
          });
        });

        stops.data.forEach(stop => {
          const point = new OSPoint(stop.Location_Northing, stop.Location_Easting);
          const latLong = point.toWGS84();
          if (!isNaN(latLong.longitude) && !isNaN(latLong.latitude)) {
            this.stops.push({
              name: stop.Stop_Name.toLowerCase(),
              location: [latLong.longitude, latLong.latitude]
            });
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
