<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: "Checkbox",
  emits: ['update:modelValue'],
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    label: {
      type: String,
      default: ''
    },
  },
})
</script>

<template>

</template>

<style scoped lang="scss">

</style>