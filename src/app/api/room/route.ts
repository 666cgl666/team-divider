import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 游戏日志接口
interface GameLog {
  id: string;
  timestamp: number;
  gameNumber: number;
  players: Player[];
  teams: {
    team1: Player[];
    team2: Player[];
  };
  traitors: string[];
}

// 玩家接口
interface Player {
  id: string;
  name: string;
  isTraitor: boolean;
  team: number;
  joinedAt: number;
}

// 房间状态接口
interface RoomState {
  players: Player[];
  gamePhase: 'waiting' | 'playing' | 'finished';
  teams: {
    team1: Player[];
    team2: Player[];
  };
  playerCount: number;
  waitingQueue: Player[];
  waitingCount: number;
  gameNumber: number;
}

// 全局状态存储
let globalRoom: RoomState = {
  players: [],
  gamePhase: 'waiting',
  teams: { team1: [], team2: [] },
  playerCount: 0,
  waitingQueue: [],
  waitingCount: 0,
  gameNumber: 1
};

// 游戏日志存储
let gameLogs: GameLog[] = [];

// 日志文件路径
const LOGS_FILE = path.join(process.cwd(), 'game_logs.json');

// 加载历史日志
function loadLogs() {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      const data = fs.readFileSync(LOGS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      gameLogs = parsed.logs || [];
      globalRoom.gameNumber = parsed.gameNumber || 1;
      console.log(`📚 加载了 ${gameLogs.length} 条历史游戏记录`);
    }
  } catch (error) {
    console.error('加载日志失败:', error);
  }
}

// 保存日志
function saveLogs() {
  try {
    const data = {
      logs: gameLogs,
      gameNumber: globalRoom.gameNumber,
      lastUpdated: Date.now()
    };
    fs.writeFileSync(LOGS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('保存日志失败:', error);
  }
}

// 生成唯一名字
function generateUniqueName(baseName: string, existingPlayers: Player[]): string {
  const existingNames = existingPlayers.map(p => p.name);
  let uniqueName = baseName;
  let counter = 2;
  
  while (existingNames.includes(uniqueName)) {
    uniqueName = `${baseName}${counter}`;
    counter++;
  }
  
  return uniqueName;
}

// Fisher-Yates 洗牌算法
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 分配队伍和内鬼
function assignTeamsAndTraitors(players: Player[]): { team1: Player[], team2: Player[] } {
  const shuffledPlayers = shuffleArray(players);
  
  // 随机选择4个内鬼位置
  const traitorIndices = new Set<number>();
  while (traitorIndices.size < 4) {
    traitorIndices.add(Math.floor(Math.random() * 10));
  }
  
  // 标记内鬼
  shuffledPlayers.forEach((player, index) => {
    player.isTraitor = traitorIndices.has(index);
  });
  
  // 分离内鬼和普通玩家
  const traitors = shuffledPlayers.filter(p => p.isTraitor);
  const regulars = shuffledPlayers.filter(p => !p.isTraitor);
  
  // 再次洗牌确保随机性
  const shuffledTraitors = shuffleArray(traitors);
  const shuffledRegulars = shuffleArray(regulars);
  
  // 分成两队
  const team1: Player[] = [
    shuffledTraitors[0], shuffledTraitors[1],
    shuffledRegulars[0], shuffledRegulars[1], shuffledRegulars[2]
  ];
  
  const team2: Player[] = [
    shuffledTraitors[2], shuffledTraitors[3],
    shuffledRegulars[3], shuffledRegulars[4], shuffledRegulars[5]
  ];
  
  // 洗牌队伍内部顺序
  const finalTeam1 = shuffleArray(team1);
  const finalTeam2 = shuffleArray(team2);
  
  // 设置队伍编号
  finalTeam1.forEach(player => player.team = 1);
  finalTeam2.forEach(player => player.team = 2);
  
  return { team1: finalTeam1, team2: finalTeam2 };
}

// 记录游戏日志
function logGame(players: Player[], teams: { team1: Player[], team2: Player[] }) {
  const traitors = players.filter(p => p.isTraitor).map(p => p.id);
  
  const gameLog: GameLog = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    gameNumber: globalRoom.gameNumber,
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
  
  // 保存到文件
  saveLogs();
  
  console.log(`🎮 游戏 #${globalRoom.gameNumber} 开始！`);
  console.log(`📊 玩家: ${players.map(p => p.name).join(', ')}`);
  console.log(`🕵️ 内鬼: ${players.filter(p => p.isTraitor).map(p => p.name).join(', ')}`);
  console.log(`👥 第一队: ${teams.team1.map(p => p.name).join(', ')}`);
  console.log(`👥 第二队: ${teams.team2.map(p => p.name).join(', ')}`);
}

// 初始化时加载日志
loadLogs();

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
        
        console.log(`⏳ ${uniqueName} 加入等待队列 (位置: ${globalRoom.waitingQueue.length})`);
        
        return NextResponse.json({ 
          player: newPlayer,
          roomState: globalRoom,
          waitingPosition: globalRoom.waitingQueue.length
        }, { status: 202 });
      }
      
      // 加入房间
      globalRoom.players.push(newPlayer);
      globalRoom.playerCount = globalRoom.players.length;
      
      console.log(`✅ ${uniqueName} 加入房间 (${globalRoom.playerCount}/10)`);
      
      // 如果达到10人，开始游戏
      if (globalRoom.players.length === 10) {
        globalRoom.gamePhase = 'playing';
        const teams = assignTeamsAndTraitors(globalRoom.players);
        globalRoom.teams = teams;
        
        // 记录游戏日志
        logGame(globalRoom.players, teams);
        
        // 30秒后重置房间
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
            gameNumber: globalRoom.gameNumber + 1
          };
          
          if (playersToMove.length > 0) {
            console.log(`🎯 ${playersToMove.length} 名等待玩家进入新房间`);
          }
        }, 30000);
      }
      
      return NextResponse.json({
        player: newPlayer,
        roomState: globalRoom
      });
    }
    
    if (action === 'leave') {
      // 从房间中移除玩家
      const playerInRoom = globalRoom.players.find(p => p.id === playerId);
      const playerInQueue = globalRoom.waitingQueue.find(p => p.id === playerId);
      
      if (playerInRoom) {
        globalRoom.players = globalRoom.players.filter(p => p.id !== playerId);
        globalRoom.playerCount = globalRoom.players.length;
        console.log(`❌ ${playerInRoom.name} 离开房间 (${globalRoom.playerCount}/10)`);
      }
      
      if (playerInQueue) {
        globalRoom.waitingQueue = globalRoom.waitingQueue.filter(p => p.id !== playerId);
        globalRoom.waitingCount = globalRoom.waitingQueue.length;
        console.log(`❌ ${playerInQueue.name} 离开等待队列`);
      }
      
      return NextResponse.json({
        success: true,
        roomState: globalRoom
      });
    }
    
    if (action === 'getLogs') {
      // 获取游戏日志
      return NextResponse.json({
        logs: gameLogs.slice(-10), // 返回最近10场游戏
        totalGames: gameLogs.length
      });
    }
    
    return NextResponse.json({ error: '无效的操作' }, { status: 400 });
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
