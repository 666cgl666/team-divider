// Cloudflare Edge Runtime 版本的API路由
import { NextRequest, NextResponse } from 'next/server';

// 导入类型定义
interface Player {
  id: string;
  name: string;
  isTraitor: boolean;
  team: number;
  joinedAt: number;
}

interface RoomState {
  players: Player[];
  gamePhase: 'waiting' | 'playing';
  teams: { team1: Player[]; team2: Player[] };
  playerCount: number;
  waitingQueue: Player[];
  waitingCount: number;
  gameNumber?: number;
}

interface GameLog {
  id: string;
  timestamp: number;
  gameNumber: number;
  players: Player[];
  teams: { team1: Player[]; team2: Player[] };
  traitors: string[];
}

// 由于Cloudflare Edge Runtime的限制，我们使用内存存储
// 在生产环境中，建议使用Cloudflare KV或Durable Objects
let globalRoom: RoomState = {
  players: [],
  gamePhase: 'waiting',
  teams: { team1: [], team2: [] },
  playerCount: 0,
  waitingQueue: [],
  waitingCount: 0,
  gameNumber: 1
};

let gameLogs: GameLog[] = [];

// 工具函数
function generateUniqueName(baseName: string, existingPlayers: Player[]): string {
  const existingNames = existingPlayers.map(p => p.name);
  let uniqueName = baseName;
  let counter = 1;
  
  while (existingNames.includes(uniqueName)) {
    uniqueName = `${baseName}${counter}`;
    counter++;
  }
  
  return uniqueName;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function assignTeamsAndTraitors(players: Player[]): { team1: Player[], team2: Player[] } {
  const shuffledPlayers = shuffleArray(players);
  
  // 随机选择2个内鬼
  const traitorIndices = new Set<number>();
  while (traitorIndices.size < 2) {
    traitorIndices.add(Math.floor(Math.random() * 10));
  }
  
  // 设置内鬼标记
  shuffledPlayers.forEach((player, index) => {
    player.isTraitor = traitorIndices.has(index);
  });
  
  // 分成两队，每队5人
  const team1 = shuffledPlayers.slice(0, 5);
  const team2 = shuffledPlayers.slice(5, 10);
  
  // 洗牌队伍内部顺序
  const finalTeam1 = shuffleArray(team1);
  const finalTeam2 = shuffleArray(team2);
  
  // 设置队伍编号
  finalTeam1.forEach(player => player.team = 1);
  finalTeam2.forEach(player => player.team = 2);
  
  return { team1: finalTeam1, team2: finalTeam2 };
}

function logGame(players: Player[], teams: { team1: Player[], team2: Player[] }) {
  const traitors = players.filter(p => p.isTraitor).map(p => p.id);
  
  const gameLog: GameLog = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    gameNumber: globalRoom.gameNumber || 1,
    players: [...players],
    teams: {
      team1: [...teams.team1],
      team2: [...teams.team2]
    },
    traitors
  };
  
  gameLogs.push(gameLog);
  
  // 保留最近100场游戏记录
  if (gameLogs.length > 100) {
    gameLogs = gameLogs.slice(-100);
  }
  
  console.log(`🎮 游戏 #${globalRoom.gameNumber} 开始！`);
}

// 设置Edge Runtime
export const runtime = 'edge';

// GET - 获取房间状态
export async function GET() {
  return NextResponse.json({
    ...globalRoom,
    totalGames: gameLogs.length
  });
}

// POST - 房间操作
export async function POST(request: NextRequest) {
  try {
    const { action, playerName, playerId } = await request.json();
    
    if (action === 'join') {
      // 检查游戏是否正在进行
      if (globalRoom.gamePhase === 'playing') {
        return NextResponse.json({ error: '游戏正在进行中，请稍后再试' }, { status: 400 });
      }
      
      // 生成唯一名字
      const allPlayers = [...globalRoom.players, ...globalRoom.waitingQueue];
      const uniqueName = generateUniqueName(playerName, allPlayers);
      
      // 创建新玩家
      const newPlayer: Player = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: uniqueName,
        isTraitor: false,
        team: 0,
        joinedAt: Date.now()
      };
      
      // 如果房间已满10人，加入等待队列
      if (globalRoom.players.length >= 10) {
        globalRoom.waitingQueue.push(newPlayer);
        globalRoom.waitingCount = globalRoom.waitingQueue.length;
        
        return NextResponse.json({ 
          player: newPlayer,
          roomState: globalRoom,
          waitingPosition: globalRoom.waitingQueue.length
        }, { status: 202 });
      }
      
      // 加入房间
      globalRoom.players.push(newPlayer);
      globalRoom.playerCount = globalRoom.players.length;
      
      // 如果达到10人，开始游戏
      if (globalRoom.players.length === 10) {
        globalRoom.gamePhase = 'playing';
        const teams = assignTeamsAndTraitors(globalRoom.players);
        globalRoom.teams = teams;
        
        // 记录游戏日志
        logGame(globalRoom.players, teams);
        
        // 5秒后重置房间
        setTimeout(() => {
          console.log(`🔄 游戏 #${globalRoom.gameNumber} 结束，房间重置`);

          // 从等待队列中移动玩家到房间
          const playersToMove = globalRoom.waitingQueue.splice(0, Math.min(10, globalRoom.waitingQueue.length));

          globalRoom = {
            players: playersToMove,
            gamePhase: 'waiting',
            teams: { team1: [], team2: [] },
            playerCount: playersToMove.length,
            waitingQueue: globalRoom.waitingQueue,
            waitingCount: globalRoom.waitingQueue.length,
            gameNumber: (globalRoom.gameNumber || 1) + 1
          };

          if (playersToMove.length > 0) {
            console.log(`🎯 ${playersToMove.length} 名等待玩家进入新房间`);
          }
        }, 5000);
      }
      
      return NextResponse.json({
        player: newPlayer,
        roomState: globalRoom
      });
    }
    
    if (action === 'leave') {
      if (!playerId) {
        return NextResponse.json({ error: '缺少玩家ID' }, { status: 400 });
      }
      
      // 从房间中移除玩家
      const playerIndex = globalRoom.players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        const removedPlayer = globalRoom.players.splice(playerIndex, 1)[0];
        globalRoom.playerCount = globalRoom.players.length;
        console.log(`❌ ${removedPlayer.name} 离开房间 (${globalRoom.playerCount}/10)`);
      }
      
      // 从等待队列中移除玩家
      const queueIndex = globalRoom.waitingQueue.findIndex(p => p.id === playerId);
      if (queueIndex !== -1) {
        const removedPlayer = globalRoom.waitingQueue.splice(queueIndex, 1)[0];
        globalRoom.waitingCount = globalRoom.waitingQueue.length;
        console.log(`❌ ${removedPlayer.name} 离开等待队列`);
      }
      
      return NextResponse.json({ roomState: globalRoom });
    }
    
    if (action === 'getLogs') {
      return NextResponse.json({
        logs: gameLogs.slice(-50), // 返回最近50场游戏
        totalGames: gameLogs.length
      });
    }
    
    return NextResponse.json({ error: '未知操作' }, { status: 400 });
    
  } catch (error) {
    console.error('API错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
