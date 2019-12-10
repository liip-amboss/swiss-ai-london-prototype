<template>
  <MglMap
    :accessToken="accessToken"
    :mapStyle="mapStyle"
    @load="onMapLoad"
    :center="[8.5155, 47.1662]"
    :zoom="9"
  >
    <MglMarker
      v-for="stop in stops"
      :coordinates="stop.location"
      color="blue"
      :key="stop.name + stop.location[0]"
    />
  </MglMap>
</template>

<script>
import Mapbox from 'mapbox-gl';
import { MglMap, MglMarker } from 'vue-mapbox';

import PapaParse from 'papaparse';
import axios from 'axios';
import OSPoint from 'ospoint';

export default {
  components: {
    MglMap,
    MglMarker
  },
  data() {
    return {
      accessToken:
        'pk.eyJ1Ijoiam9uYXNuaWVzdHJvaiIsImEiOiJjazN6bmt3dHowandwM21wMzcwc21vdjdxIn0.P496caPNw9SXrMl_GbzHdw', // your access token. Needed if you using Mapbox maps
      mapStyle: 'mapbox://styles/mapbox/streets-v11', // your map style
      stops: []
    };
  },

  created() {
    // We need to set mapbox-gl library here in order to use it in template
    this.mapbox = Mapbox;
  },
  mounted() {
    axios.get('stop-sequences-example.csv').then(response => {
      const stops = PapaParse.parse(response.data, { header: true });
      stops.data.forEach(stop => {
        const point = new OSPoint(stop.Location_Northing, stop.Location_Easting);
        const latLong = point.toWGS84();
        if (!isNaN(latLong.longitude) && !isNaN(latLong.latitude)) {
          this.stops.push({
            name: stop.Stop_Name,
            location: [latLong.longitude, latLong.latitude]
          });
          //console.log(latLong);
        }
      });
    });
  },
  methods: {
    async onMapLoad(event) {
      const asyncActions = event.component.actions;

      const newParams = await asyncActions.flyTo({
        center: [-0.1, 51.5],
        zoom: 12,
        speed: 0.7
      });
    }
  }
};
</script>
