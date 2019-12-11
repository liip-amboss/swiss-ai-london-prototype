import Vue from "vue";
import App from "./App.vue";
import Vuex from "vuex";

Vue.config.productionTip = false;

Vue.use(Vuex);

const store = new Vuex.Store({
  state: {
    actualRoute: "9"
  },
  mutations: {
    setActualRoute(state, actualRoute) {
      state.actualRoute = actualRoute;
    }
  }
});

new Vue({
  store,
  render: h => h(App)
}).$mount("#app");
