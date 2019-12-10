<template>
  <div id="app" class="master">
    <Map />
  </div>
</template>

<script>
import Map from '@/components/Map';

export default {
  name: 'app',
  components: {
    Map
  }
};
</script>

<style>
body {
  margin: 0;
}

.master {
  min-height: 100vh;
}
</style>
