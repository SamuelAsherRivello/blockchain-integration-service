<script setup lang="ts">
import diagramUrl from '../../diagrams/bis-sequence-diagram-2.png'
</script>

<template>
  <img
    v-bind="$attrs"
    :src="diagramUrl"
    alt="BIS game-flow diagram: Bitcoin, ARK, Arkade, BIS, and Game lanes show account login, funding, asset minting, contracts, play payments, earnings, and Bitcoin withdrawal."
  >
</template>
