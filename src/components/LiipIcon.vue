<template>
  <button @click="openLiipSite" class="liip-icon">
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 20">
      <path
        fill="#6EA644"
        fill-rule="evenodd"
        d="M19.89 0L24 2.007 14.785 20l-4.111-2.007L19.89 0zM9.282 0l4.044 2.007L4.11 20 0 17.993 9.282 0z"
      />
    </svg>
  </button>
</template>

<script>
export default {
  methods: {
    openLiipSite() {
      const win = window.open('https://www.liip.ch', '_blank');
      win.focus();
    }
  }
};
</script>

<style>
.liip-icon {
  display: flex;
  position: absolute;
  z-index: 10;
  right: 20px;
  bottom: 20px;
  background-color: white;
  padding: 0.5rem;
  border-radius: 30px;
  cursor: pointer;
}
</style>
