// 客户端房间状态管理（用于静态部署）
export interface Player {
  id: string;
  name: string;
  isTraitor: boolean;
  team: number;
  joinedAt: number;
}

export interface RoomState {
  players: Player[];
  gamePhase: 'waiting' | 'playing' | 'finished';
  teams: {
    team1: Player[];
    team2: Player[];
  };
  playerCount: number;
  waitingQueue: Player[];
  waitingCount: number;
}

// 全局状态（在浏览器中共享）
class ClientRoomManager {
  private static instance: ClientRoomManager;
  private roomState: RoomState;
  private listeners: ((state: RoomState) => void)[] = [];

  private constructor() {
    this.roomState = {
      players: [],
      gamePhase: 'waiting',
      teams: { team1: [], team2: [] },
      playerCount: 0,
      waitingQueue: [],
      waitingCount: 0
    };

    // 尝试从localStorage恢复状态
    this.loadFromStorage();
  }

  static getInstance(): ClientRoomManager {
    if (!ClientRoomManager.instance) {
      ClientRoomManager.instance = new ClientRoomManager();
    }
    return ClientRoomManager.instance;
  }

  private saveToStorage() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('roomState', JSON.stringify(this.roomState));
    }
  }

  private loadFromStorage() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('roomState');
      if (saved) {
        try {
          this.roomState = JSON.parse(saved);
        } catch (e) {
          console.error('Failed to load room state from storage:', e);
        }
      }
    }
  }

  private notify() {
    this.saveToStorage();
    this.listeners.forEach(listener => listener(this.roomState));
  }

  subscribe(listener: (state: RoomState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getRoomState(): RoomState {
    return { ...this.roomState };
  }

  // 生成唯一名字
  private generateUniqueName(baseName: string): string {
    const existingNames = [
      ...this.roomState.players.map(p => p.name),
      ...this.roomState.waitingQueue.map(p => p.name)
    ];
    
    let uniqueName = baseName;
    let counter = 2;
    
    while (existingNames.includes(uniqueName)) {
      uniqueName = `${baseName}${counter}`;
      counter++;
    }
    
    return uniqueName;
  }

  // Fisher-Yates 洗牌算法
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // 分配队伍和内鬼
  private assignTeamsAndTraitors(players: Player[]): { team1: Player[], team2: Player[] } {
    const shuffledPlayers = this.shuffleArray(players);
    
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
    const shuffledTraitors = this.shuffleArray(traitors);
    const shuffledRegulars = this.shuffleArray(regulars);
    
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
    const finalTeam1 = this.shuffleArray(team1);
    const finalTeam2 = this.shuffleArray(team2);
    
    // 设置队伍编号
    finalTeam1.forEach(player => player.team = 1);
    finalTeam2.forEach(player => player.team = 2);
    
    return { team1: finalTeam1, team2: finalTeam2 };
  }

  joinRoom(playerName: string): { player: Player; roomState: RoomState; waitingPosition?: number } {
    if (this.roomState.gamePhase === 'playing') {
      throw new Error('游戏正在进行中，请稍后再试');
    }

    const uniqueName = this.generateUniqueName(playerName);
    const newPlayer: Player = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: uniqueName,
      isTraitor: false,
      team: 0,
      joinedAt: Date.now()
    };

    // 如果房间已满，加入等待队列
    if (this.roomState.players.length >= 10) {
      this.roomState.waitingQueue.push(newPlayer);
      this.roomState.waitingCount = this.roomState.waitingQueue.length;
      this.notify();
      
      return {
        player: newPlayer,
        roomState: this.getRoomState(),
        waitingPosition: this.roomState.waitingQueue.length
      };
    }

    // 加入房间
    this.roomState.players.push(newPlayer);
    this.roomState.playerCount = this.roomState.players.length;

    // 如果达到10人，开始游戏
    if (this.roomState.players.length === 10) {
      this.roomState.gamePhase = 'playing';
      const teams = this.assignTeamsAndTraitors(this.roomState.players);
      this.roomState.teams = teams;

      // 30秒后重置房间
      setTimeout(() => {
        this.roomState = {
          players: [],
          gamePhase: 'waiting',
          teams: { team1: [], team2: [] },
          playerCount: 0,
          waitingQueue: this.roomState.waitingQueue.splice(0, Math.min(10, this.roomState.waitingQueue.length)),
          waitingCount: this.roomState.waitingQueue.length
        };
        this.roomState.playerCount = this.roomState.players.length;
        this.notify();
      }, 30000);
    }

    this.notify();
    return {
      player: newPlayer,
      roomState: this.getRoomState()
    };
  }

  leaveRoom(playerId: string): { roomState: RoomState } {
    this.roomState.players = this.roomState.players.filter(p => p.id !== playerId);
    this.roomState.waitingQueue = this.roomState.waitingQueue.filter(p => p.id !== playerId);
    this.roomState.playerCount = this.roomState.players.length;
    this.roomState.waitingCount = this.roomState.waitingQueue.length;
    
    this.notify();
    return { roomState: this.getRoomState() };
  }
}

export const roomManager = ClientRoomManager.getInstance();
