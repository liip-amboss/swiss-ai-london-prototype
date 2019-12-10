<template>
  <MglMap :accessToken="accessToken" :mapStyle="mapStyle" />
</template>

<script>
import Mapbox from 'mapbox-gl';
import { MglMap } from 'vue-mapbox';

export default {
  components: {
    MglMap
  },
  data() {
    return {
      accessToken:
        'pk.eyJ1Ijoiam9uYXNuaWVzdHJvaiIsImEiOiJjazN6bmt3dHowandwM21wMzcwc21vdjdxIn0.P496caPNw9SXrMl_GbzHdw', // your access token. Needed if you using Mapbox maps
      mapStyle: 'mapbox://styles/mapbox/streets-v11' // your map style
    };
  },

  created() {
    // We need to set mapbox-gl library here in order to use it in template
    this.mapbox = Mapbox;
  }
};
</script>
