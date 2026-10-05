<script setup lang="ts">
import beamable from '../../../assets/logos-template/beamable.png'
import bladesOfBrim from '../../../assets/logos-template/blades-of-brim.png'
import blockchainLogoStrip from '../../../assets/logos-template/blockchain-logo-strip.png'
import entertainmentLogoStrip from '../../../assets/logos-template/entertainment-logo-strip.png'
import neopets from '../../../assets/logos-template/neopets.png'
import packt from '../../../assets/logos-template/packt.png'
import clientList from '../../../assets/logos-template/client-list.png'
import saganworks from '../../../assets/logos-template/saganworks.png'
import shiftlings from '../../../assets/logos-template/shiftlings.png'
import sierra from '../../../assets/logos-template/sierra.png'
import subwaySurfers from '../../../assets/logos-template/subway-surfers.png'
import udemy from '../../../assets/logos-template/udemy.png'
import usc from '../../../assets/logos-template/usc.png'
import ucla from '../../../assets/logos-template/ucla.png'
</script>

<template>
  <div class="slidev-layout mondrian-blank-template mondrian-logos-template">
    <div class="mondrian-xp-copy"><slot /></div>
    <a class="mondrian-logos-template__link mondrian-logos-template__asset--packt" href="https://www.packtpub.com/" target="_blank" rel="noreferrer" aria-label="Visit Packt"><img class="mondrian-logos-template__asset" style="--xp-image-delay: 400ms" :src="packt" alt="Packt" /></a>
    <div class="mondrian-logos-template__strip mondrian-logos-template__asset--entertainment" aria-label="Entertainment client logos"><img class="mondrian-logos-template__asset" style="--xp-image-delay: 800ms" :src="entertainmentLogoStrip" alt="Entertainment client logos" /></div>
    <div class="mondrian-logos-template__strip mondrian-logos-template__asset--blockchain" aria-label="Blockchain client logos"><img class="mondrian-logos-template__asset" style="--xp-image-delay: 900ms" :src="blockchainLogoStrip" alt="Blockchain client logos" /></div>
    <a class="mondrian-logos-template__link mondrian-logos-template__asset--beamable" href="https://beamable.com/" target="_blank" rel="noreferrer" aria-label="Visit Beamable"><img class="mondrian-logos-template__asset" style="--xp-image-delay: 1000ms" :src="beamable" alt="Beamable" /></a>
    <a class="mondrian-logos-template__link mondrian-logos-template__asset--saganworks" href="https://saganworks.com/" target="_blank" rel="noreferrer" aria-label="Visit Saganworks"><img class="mondrian-logos-template__asset" style="--xp-image-delay: 700ms" :src="saganworks" alt="Saganworks" /></a>
    <a class="mondrian-logos-template__link mondrian-logos-template__asset--subway-surfers mondrian-logos-template__final-three mondrian-logos-template__final-three--first" href="https://subwaysurfers.com/" target="_blank" rel="noreferrer" aria-label="Visit Subway Surfers"><img class="mondrian-logos-template__asset" style="--xp-image-delay: 2000ms" :src="subwaySurfers" alt="Subway Surfers" /></a>
    <a class="mondrian-logos-template__link mondrian-logos-template__asset--blades-of-brim mondrian-logos-template__final-three mondrian-logos-template__final-three--second" href="https://sybogames.com/blades-of-brim/" target="_blank" rel="noreferrer" aria-label="Visit Blades of Brim"><img class="mondrian-logos-template__asset" style="--xp-image-delay: 2500ms" :src="bladesOfBrim" alt="Blades of Brim" /></a>
    <a class="mondrian-logos-template__link mondrian-logos-template__asset--shittings" href="https://www.sierragames.com/shiftlings" target="_blank" rel="noreferrer" aria-label="Visit Shiftlings"><img class="mondrian-logos-template__asset" style="--xp-image-delay: 200ms" :src="shiftlings" alt="Shiftlings" /></a>
    <a class="mondrian-logos-template__link mondrian-logos-template__asset--sierra" href="https://www.sierragames.com/" target="_blank" rel="noreferrer" aria-label="Visit Sierra Games"><img class="mondrian-logos-template__asset" style="--xp-image-delay: 500ms" :src="sierra" alt="Sierra" /></a>
    <a class="mondrian-logos-template__link mondrian-logos-template__asset--ucla" href="https://www.ucla.edu/" target="_blank" rel="noreferrer" aria-label="Visit UCLA"><img class="mondrian-logos-template__asset" style="--xp-image-delay: 300ms" :src="ucla" alt="UCLA" /></a>
    <a class="mondrian-logos-template__link mondrian-logos-template__asset--usc" href="https://www.usc.edu/" target="_blank" rel="noreferrer" aria-label="Visit USC"><img class="mondrian-logos-template__asset" style="--xp-image-delay: 600ms" :src="usc" alt="USC" /></a>
    <a class="mondrian-logos-template__link mondrian-logos-template__asset--udemy" href="https://www.udemy.com/" target="_blank" rel="noreferrer" aria-label="Visit Udemy"><img class="mondrian-logos-template__asset" style="--xp-image-delay: 100ms" :src="udemy" alt="Udemy" /></a>
    <a class="mondrian-logos-template__link mondrian-logos-template__asset--neopets" href="https://www.neopets.com/" target="_blank" rel="noreferrer" aria-label="Visit Neopets"><img class="mondrian-logos-template__asset" style="--xp-image-delay: 1100ms" :src="neopets" alt="Neopets" /></a>
    <a class="mondrian-logos-template__link mondrian-logos-template__asset--playstudios mondrian-logos-template__final-three mondrian-logos-template__final-three--third" href="https://www.foresightsports.com/" target="_blank" rel="noreferrer" aria-label="Visit Foresight Sports"><img class="mondrian-logos-template__asset" style="--xp-image-delay: 3000ms" :src="clientList" alt="Foresight Sports" /></a>
  </div>
</template>
