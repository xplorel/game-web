<template>
  <main class="game-root">
    <section v-if="stage === 'home'" class="home-panel">
      <p class="eyebrow">3D WEB ADVENTURE</p>
      <h1>星界漫游者 3D</h1>
      <p>这是一个 Three.js 3D 网页游戏原型。进入场景后，你可以控制角色在地图中移动，镜头会自动跟随。</p>
      <button class="primary-btn" @click="startGame">进入 3D 世界</button>
    </section>

    <section v-else class="world-screen">
      <div ref="worldRef" class="world-canvas"></div>
      <div class="hud top-left">
        <p class="eyebrow">MISSION</p>
        <strong>寻找发光传送门</strong>
        <span>{{ message }}</span>
      </div>
      <div class="hud bottom-left">
        <strong>操作</strong>
        <span>WASD / 方向键移动</span>
        <span>按住 Shift 加速</span>
      </div>
      <button class="exit-btn" @click="backHome">退出</button>
    </section>
  </main>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { ThreeAdventure } from './game/ThreeAdventure';

const stage = ref<'home' | 'world'>('home');
const worldRef = ref<HTMLElement | null>(null);
const message = ref('准备进入星界。');
let game: ThreeAdventure | null = null;

async function startGame() {
  stage.value = 'world';
  message.value = '加载 3D 场景中...';
  await nextTick();

  if (!worldRef.value) return;
  game?.destroy();
  game = new ThreeAdventure(worldRef.value, {
    onMessage: text => {
      message.value = text;
    },
  });
  game.start();
}

function backHome() {
  game?.destroy();
  game = null;
  stage.value = 'home';
  message.value = '准备进入星界。';
}

onBeforeUnmount(() => {
  game?.destroy();
});
</script>