<template>
  <main class="game-root">
    <section v-if="stage === 'home'" class="home-panel">
      <p class="eyebrow">RETRO RUN & GUN · ACCEPTANCE BUILD</p>
      <h1>钢铁突击 · 通关版</h1>
      <p>横版通关射击游戏：跑动、跳跃、射击、敌人、炮台、飞行器、Boss、爆炸和通关结算。</p>
      <button class="primary-btn" @click="startGame">开始闯关</button>
    </section>

    <section v-else class="run-screen">
      <canvas ref="canvasRef" class="run-canvas" width="960" height="540"></canvas>

      <div class="hud top-left">
        <p class="eyebrow">MISSION</p>
        <strong>{{ status.message }}</strong>
      </div>

      <div class="hud top-right">
        <span>HP：{{ status.hp }}</span>
        <span>生命：{{ status.lives }}</span>
        <span>分数：{{ status.score }}</span>
      </div>

      <div class="hud bottom-left">
        <strong>操作</strong>
        <span>A/D 或方向键：移动</span>
        <span>W/K/↑：跳跃</span>
        <span>J/X/Ctrl/空格：射击</span>
      </div>

      <button class="exit-btn" @click="backHome">退出</button>
    </section>
  </main>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, reactive, ref } from 'vue';
import { RunGunGame } from './game/CleanRunGun';

const stage = ref<'home' | 'game'>('home');
const canvasRef = ref<HTMLCanvasElement | null>(null);
const status = reactive({
  hp: 100,
  lives: 3,
  score: 0,
  message: '准备突击。',
  state: 'playing' as 'playing' | 'win' | 'lose',
});
let game: RunGunGame | null = null;

async function startGame() {
  stage.value = 'game';
  await nextTick();

  if (!canvasRef.value) return;
  game?.destroy();
  game = new RunGunGame(canvasRef.value, {
    onStatus: value => {
      status.hp = value.hp;
      status.lives = value.lives;
      status.score = value.score;
      status.message = value.message;
      status.state = value.state;
    },
  });
  game.start();
}

function backHome() {
  game?.destroy();
  game = null;
  stage.value = 'home';
}

onBeforeUnmount(() => {
  game?.destroy();
});
</script>