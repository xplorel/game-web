<template>
  <main class="app-shell">
    <section v-if="stage === 'home'" class="home-card">
      <p class="eyebrow">TURN BASED RPG</p>
      <h1>星界回合战</h1>
      <p class="subtitle">选择攻击、防御、技能或治疗，与深渊守卫进行一场回合制战斗。</p>
      <button class="primary-btn" @click="startGame">开始战斗</button>
    </section>

    <section v-else class="battle-card">
      <header class="battle-header">
        <button class="ghost-btn" @click="backHome">返回</button>
        <div>
          <p class="eyebrow">第 {{ round }} 回合</p>
          <h2>{{ turn === 'player' ? '你的回合' : '敌人行动中' }}</h2>
        </div>
        <button class="ghost-btn" @click="restartGame">重开</button>
      </header>

      <div class="arena">
        <article class="fighter player">
          <div class="avatar">🛡️</div>
          <h3>{{ player.name }}</h3>
          <div class="hp-row"><span>HP</span><strong>{{ player.hp }}/{{ player.maxHp }}</strong></div>
          <div class="hp-track"><i :style="{ width: hpPercent(player) + '%' }"></i></div>
          <p class="status">{{ player.defending ? '防御姿态：下次受伤减半' : '等待指令' }}</p>
        </article>

        <div class="vs-badge">VS</div>

        <article class="fighter enemy">
          <div class="avatar">🐉</div>
          <h3>{{ enemy.name }}</h3>
          <div class="hp-row"><span>HP</span><strong>{{ enemy.hp }}/{{ enemy.maxHp }}</strong></div>
          <div class="hp-track danger"><i :style="{ width: hpPercent(enemy) + '%' }"></i></div>
          <p class="status">{{ enemy.defending ? '正在蓄力防御' : '虎视眈眈' }}</p>
        </article>
      </div>

      <div class="skill-panel">
        <button :disabled="!canAct" @click="playerAttack">普通攻击<span>稳定造成伤害</span></button>
        <button :disabled="!canAct" @click="playerSkill">星火斩<span>高伤害，有冷却</span></button>
        <button :disabled="!canAct" @click="playerDefend">防御<span>降低下次伤害</span></button>
        <button :disabled="!canAct" @click="playerHeal">治疗<span>恢复生命值</span></button>
      </div>

      <section class="log-card">
        <h3>战斗记录</h3>
        <ul>
          <li v-for="item in logs" :key="item">{{ item }}</li>
        </ul>
      </section>
    </section>

    <div v-if="result" class="modal-mask">
      <div class="result-modal">
        <p class="eyebrow">BATTLE RESULT</p>
        <h2>{{ result === 'win' ? '胜利' : '失败' }}</h2>
        <p>{{ result === 'win' ? '你击败了深渊守卫。' : '你被深渊守卫击败了。' }}</p>
        <button class="primary-btn" @click="restartGame">再战一局</button>
        <button class="text-btn" @click="backHome">回到首页</button>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

type Fighter = {
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defending: boolean;
};

const stage = ref<'home' | 'battle'>('home');
const turn = ref<'player' | 'enemy'>('player');
const result = ref<'win' | 'lose' | null>(null);
const round = ref(1);
const skillCooldown = ref(0);
const logs = ref<string[]>([]);

const player = reactive<Fighter>({ name: '星界骑士', hp: 120, maxHp: 120, attack: 18, defending: false });
const enemy = reactive<Fighter>({ name: '深渊守卫', hp: 150, maxHp: 150, attack: 15, defending: false });

const canAct = computed(() => stage.value === 'battle' && turn.value === 'player' && !result.value);

function resetFighter(target: Fighter, hp: number, attack: number) {
  target.hp = hp;
  target.maxHp = hp;
  target.attack = attack;
  target.defending = false;
}

function startGame() {
  stage.value = 'battle';
  result.value = null;
  turn.value = 'player';
  round.value = 1;
  skillCooldown.value = 0;
  resetFighter(player, 120, 18);
  resetFighter(enemy, 150, 15);
  logs.value = ['战斗开始：深渊守卫出现了。'];
}

function restartGame() {
  startGame();
}

function backHome() {
  stage.value = 'home';
  result.value = null;
}

function hpPercent(fighter: Fighter) {
  return Math.max(0, Math.round((fighter.hp / fighter.maxHp) * 100));
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function appendLog(text: string) {
  logs.value = [text, ...logs.value].slice(0, 6);
}

function applyDamage(target: Fighter, damage: number) {
  const finalDamage = target.defending ? Math.ceil(damage / 2) : damage;
  target.defending = false;
  target.hp = Math.max(0, target.hp - finalDamage);
  return finalDamage;
}

function checkResult() {
  if (enemy.hp <= 0) {
    result.value = 'win';
    appendLog('战斗结束：你赢了。');
    return true;
  }

  if (player.hp <= 0) {
    result.value = 'lose';
    appendLog('战斗结束：你输了。');
    return true;
  }

  return false;
}

function endPlayerTurn() {
  if (checkResult()) return;
  turn.value = 'enemy';
  if (skillCooldown.value > 0) skillCooldown.value -= 1;
  window.setTimeout(enemyAction, 650);
}

function endEnemyTurn() {
  if (checkResult()) return;
  round.value += 1;
  turn.value = 'player';
}

function playerAttack() {
  const damage = applyDamage(enemy, player.attack + randomBetween(-3, 5));
  appendLog(`你发动普通攻击，造成 ${damage} 点伤害。`);
  endPlayerTurn();
}

function playerSkill() {
  if (skillCooldown.value > 0) {
    appendLog(`星火斩还需要 ${skillCooldown.value} 回合冷却。`);
    return;
  }

  const damage = applyDamage(enemy, 32 + randomBetween(-4, 8));
  skillCooldown.value = 2;
  appendLog(`你释放星火斩，造成 ${damage} 点伤害。`);
  endPlayerTurn();
}

function playerDefend() {
  player.defending = true;
  appendLog('你进入防御姿态，下次受到的伤害降低。');
  endPlayerTurn();
}

function playerHeal() {
  const heal = randomBetween(18, 28);
  player.hp = Math.min(player.maxHp, player.hp + heal);
  appendLog(`你使用治疗术，恢复 ${heal} 点生命。`);
  endPlayerTurn();
}

function enemyAction() {
  if (result.value) return;

  const lowHp = enemy.hp <= 45;
  const roll = Math.random();

  if (lowHp && roll < 0.32) {
    enemy.defending = true;
    appendLog('深渊守卫进入防御姿态。');
    endEnemyTurn();
    return;
  }

  if (roll > 0.72) {
    const damage = applyDamage(player, enemy.attack + randomBetween(8, 16));
    appendLog(`深渊守卫释放重击，造成 ${damage} 点伤害。`);
  } else {
    const damage = applyDamage(player, enemy.attack + randomBetween(-3, 5));
    appendLog(`深渊守卫发动攻击，造成 ${damage} 点伤害。`);
  }

  endEnemyTurn();
}
</script>
