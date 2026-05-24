<template>
  <div class="app-shell">
    <section v-if="stage === 'home'" class="home-card">
      <p class="eyebrow">Melody Match</p>
      <h1>音乐霓虹消消乐</h1>
      <p class="subtitle">点击两个相邻音符方块进行交换，连续消除获得更高分。</p>
      <button class="primary-btn" @click="startGame">开始游戏</button>
    </section>

    <section v-else class="game-card">
      <div class="top-bar">
        <div>
          <span>分数</span>
          <strong>{{ score }}</strong>
        </div>
        <div>
          <span>时间</span>
          <strong>{{ timeLeft }}s</strong>
        </div>
        <div>
          <span>目标</span>
          <strong>{{ targetScore }}</strong>
        </div>
      </div>

      <canvas ref="canvasRef" class="game-canvas" width="720" height="720"></canvas>

      <div class="action-row">
        <button class="ghost-btn" @click="restartGame">重新开始</button>
        <button class="ghost-btn" @click="backHome">返回首页</button>
      </div>
    </section>

    <div v-if="result" class="modal-mask">
      <div class="result-modal">
        <h2>{{ result === 'win' ? '挑战成功' : '挑战失败' }}</h2>
        <p>最终得分：{{ score }}</p>
        <button class="primary-btn" @click="restartGame">再来一局</button>
        <button class="text-btn" @click="backHome">回到首页</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { MatchGame } from './game/MatchGame';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const stage = ref<'home' | 'game'>('home');
const result = ref<'win' | 'lose' | null>(null);
const score = ref(0);
const timeLeft = ref(60);
const targetScore = 1200;
let game: MatchGame | null = null;
let timer: number | undefined;

function clearTimer() {
  if (timer !== undefined) {
    window.clearInterval(timer);
    timer = undefined;
  }
}

async function startGame() {
  stage.value = 'game';
  result.value = null;
  score.value = 0;
  timeLeft.value = 60;
  await nextTick();

  if (!canvasRef.value) return;

  game?.destroy();
  game = new MatchGame(canvasRef.value, {
    onScoreChange: value => {
      score.value = value;
    },
  });
  game.start();

  clearTimer();
  timer = window.setInterval(() => {
    timeLeft.value -= 1;
    if (timeLeft.value <= 0) {
      finishGame(score.value >= targetScore ? 'win' : 'lose');
    }
  }, 1000);
}

function finishGame(type: 'win' | 'lose') {
  clearTimer();
  game?.lock();
  result.value = type;
}

function restartGame() {
  startGame();
}

function backHome() {
  clearTimer();
  game?.destroy();
  game = null;
  result.value = null;
  stage.value = 'home';
}

onBeforeUnmount(() => {
  clearTimer();
  game?.destroy();
});
</script>
