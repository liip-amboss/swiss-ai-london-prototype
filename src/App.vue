<template>
  <div id="app">
    <div class="master">
      <header class="site-header">
        <h1>Swiss ai</h1>
      </header>
      <main>
        <Map class="map" />
      </main>
    </div>
  </div>
</template>

<script>
import Map from "@/components/Map";

export default {
  name: "app",
  components: {
    Map
  }
};
</script>

<style>
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  color: #353535;
}

body {
  margin: 0;
}

.master,
.map {
  min-height: 100vh;
}

.master {
  display: grid;
  grid-template-columns: 300px 1fr;
}

.site-header {
  padding: 1.5rem;
  border-right: 8px solid #9995;
}
</style>
