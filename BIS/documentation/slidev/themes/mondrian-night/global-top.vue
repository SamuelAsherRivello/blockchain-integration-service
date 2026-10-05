<template>
  <!-- Temporary Riverside crop-safe validation guides. Remove after approval. -->
  <div class="riverside-safe-area riverside-safe-area--primary" aria-hidden="true">
    <span>PRIMARY · STANDARD RIVERSIDE SAFE AREA</span>
  </div>
  <div class="riverside-safe-area riverside-safe-area--extreme" aria-hidden="true">
    <span>SECONDARY · EXTREME RIGHT-SPEAKER CROP</span>
  </div>
</template>

<style scoped>
.riverside-safe-area {
  position: absolute;
  z-index: 50;
  box-sizing: border-box;
  pointer-events: none;
}

.riverside-safe-area span {
  position: absolute;
  top: 0;
  left: 0;
  transform: translateY(-100%);
  padding: .18rem .45rem;
  font: 800 .58rem/1 Arial, Helvetica, sans-serif;
  letter-spacing: .12em;
}

.riverside-safe-area--primary {
  top: 10%;
  right: 22%;
  bottom: 10%;
  left: 10%;
  border: 4px solid #74ff4b;
  background: rgb(116 255 75 / 3%);
  box-shadow: 0 0 0 1px rgb(10 15 10 / 70%), 0 0 1.1rem rgb(116 255 75 / 42%);
}

.riverside-safe-area--primary span {
  background: #74ff4b;
  color: #0a110a;
}

.riverside-safe-area--extreme {
  top: 13%;
  right: 36%;
  bottom: 13%;
  left: 14%;
  border: 4px dashed #b6ff9e;
  background: rgb(182 255 158 / 7%);
  box-shadow: 0 0 0 1px rgb(10 15 10 / 70%), inset 0 0 1.1rem rgb(182 255 158 / 17%);
}

.riverside-safe-area--extreme span {
  background: #163b25;
  color: #d9ffcc;
}
</style>
