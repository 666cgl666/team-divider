'use client';

import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { roomManager, Player, RoomState } from '@/lib/client-room';

// 使用本地API路由
async function apiJoinRoom(playerName: string): Promise<{ player: Player; roomState: RoomState; waitingPosition?: number }> {
  const response = await fetch('/api/room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'join', playerName })
  });

  const result = await response.json();
  if (!response.ok && response.status !== 202) {
    throw new Error(result.error || '加入房间失败');
  }
  return result;
}

async function apiLeaveRoom(playerId: string): Promise<{ roomState: RoomState }> {
  const response = await fetch('/api/room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'leave', playerId })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '离开房间失败');
  }
  return response.json();
}

async function apiGetRoomState(): Promise<RoomState> {
  const response = await fetch('/api/room');
  if (!response.ok) {
    throw new Error('获取房间状态失败');
  }
  return response.json();
}

async function apiGetLogs(): Promise<{ logs: any[]; totalGames: number }> {
  const response = await fetch('/api/room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getLogs' })
  });

  if (!response.ok) {
    throw new Error('获取日志失败');
  }
  return response.json();
}

// 定义用户状态类型
type GameState = 'entering' | 'nameSet' | 'waiting' | 'result';

export default function Home() {
  const [gameState, setGameState] = useState<GameState>('entering');
  const [playerName, setPlayerName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isInWaitingQueue, setIsInWaitingQueue] = useState(false);
  const [waitingPosition, setWaitingPosition] = useState<number>(0);
  const [gameResult, setGameResult] = useState<{
    teams: { team1: Player[]; team2: Player[] };
    currentPlayerData: Player;
  } | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [gameLogs, setGameLogs] = useState<any[]>([]);

  // 初始化时从cookie读取保存的名字
  useEffect(() => {
    const cookieName = Cookies.get('playerName');
    if (cookieName) {
      setSavedName(cookieName);
      setPlayerName(cookieName);
      setGameState('nameSet');
    }
  }, []);

  // 页面关闭时自动离开房间
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentPlayer && (gameState === 'waiting' || isInWaitingQueue)) {
        // 只在等待状态时自动离开，分队后不自动离开
        navigator.sendBeacon('/api/room', JSON.stringify({
          action: 'leave',
          playerId: currentPlayer.id
        }));
      }
    };

    // 只监听页面关闭事件，不监听标签页切换
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentPlayer, gameState, isInWaitingQueue]);

  // 房间状态管理 - 使用服务器API轮询
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (gameState === 'waiting' || gameState === 'result') {
      interval = setInterval(async () => {
        try {
          const state = await apiGetRoomState();
          setRoomState(state);

          // 如果游戏开始了，切换到结果页面并保存结果
          if (state.gamePhase === 'playing' && gameState === 'waiting' && currentPlayer) {
            // 保存游戏结果，避免房间重置后丢失
            const playerInTeam1 = state.teams.team1.find(p => p.id === currentPlayer.id);
            const playerInTeam2 = state.teams.team2.find(p => p.id === currentPlayer.id);
            const currentPlayerData = playerInTeam1 || playerInTeam2 || currentPlayer;

            setGameResult({
              teams: state.teams,
              currentPlayerData
            });
            setGameState('result');
          }

          // 更新等待队列状态
          if (currentPlayer && state.waitingQueue) {
            const inQueue = state.waitingQueue.find(p => p.id === currentPlayer.id);
            if (inQueue) {
              const position = state.waitingQueue.findIndex(p => p.id === currentPlayer.id) + 1;
              setIsInWaitingQueue(true);
              setWaitingPosition(position);
            } else {
              setIsInWaitingQueue(false);
              setWaitingPosition(0);
            }
          }
        } catch (err) {
          console.error('Failed to fetch room state:', err);
          setError('连接服务器失败，请检查网络连接');
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState, currentPlayer]);

  // 保存名字到cookie
  const handleSaveName = () => {
    if (!playerName.trim()) return;

    const trimmedName = playerName.trim();
    Cookies.set('playerName', trimmedName, { expires: 30 }); // 30天过期
    setSavedName(trimmedName);
    setPlayerName(trimmedName);
    setGameState('nameSet');
    setError('');
  };

  // 更改名字
  const handleChangeName = () => {
    setGameState('entering');
    setPlayerName('');
    setError('');
  };

  // 处理加入房间（名字已经设置好了）
  const handleJoinRoom = async () => {
    if (!savedName) return;

    setLoading(true);
    setError('');

    try {
      const result = await apiJoinRoom(savedName);
      setCurrentPlayer(result.player);
      setRoomState(result.roomState);

      // 检查是否在等待队列中
      if (result.waitingPosition) {
        setIsInWaitingQueue(true);
        setWaitingPosition(result.waitingPosition);
        setError(`房间已满，你在等待队列第 ${result.waitingPosition} 位`);
      } else {
        setIsInWaitingQueue(false);
      }

      setGameState('waiting');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入房间失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理离开房间
  const handleLeaveRoom = async () => {
    if (!currentPlayer) return;

    setLoading(true);
    try {
      await apiLeaveRoom(currentPlayer.id);
      setGameState('nameSet'); // 回到名字已设置状态
      setCurrentPlayer(null);
      setRoomState(null);
      setError('');
      setIsInWaitingQueue(false);
      setWaitingPosition(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '离开房间失败');
    } finally {
      setLoading(false);
    }
  };

  // 返回首页
  const handleBackToHome = () => {
    setGameState('nameSet'); // 回到名字已设置状态，而不是重新输入名字
    setCurrentPlayer(null);
    setRoomState(null);
    setGameResult(null); // 清除游戏结果
    setShowLogs(false); // 关闭日志显示
    setGameLogs([]); // 清除日志
    setError('');
    setIsInWaitingQueue(false);
    setWaitingPosition(0);
  };

  // 查看游戏日志
  const handleViewLogs = async () => {
    try {
      setLoading(true);
      const result = await apiGetLogs();
      setGameLogs(result.logs);
      setShowLogs(true);
    } catch (err) {
      setError('获取游戏日志失败');
    } finally {
      setLoading(false);
    }
  };

  // 渲染输入名字页面
  const renderEnteringPage = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          团队分组游戏
        </h1>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <input
            type="text"
            placeholder="请输入你的名字"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && !loading && handleSaveName()}
            disabled={loading}
          />
          <button
            onClick={handleSaveName}
            disabled={!playerName.trim() || loading}
            className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            确认名字
          </button>
        </div>
      </div>
    </div>
  );

  // 渲染名字已设置页面
  const renderNameSetPage = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          准备加入游戏
        </h1>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        <div className="text-center mb-6">
          <div className="text-lg text-gray-600 mb-2">你的名字：</div>
          <div className="text-2xl font-bold text-blue-600 bg-blue-50 p-3 rounded-lg">
            {savedName}
          </div>
        </div>
        <div className="space-y-3">
          <button
            onClick={handleJoinRoom}
            disabled={loading}
            className="w-full bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '加入中...' : '加入房间'}
          </button>
          <button
            onClick={handleChangeName}
            disabled={loading}
            className="w-full bg-gray-500 text-white p-3 rounded-lg hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            更改名字
          </button>
        </div>
      </div>
    </div>
  );

  // 渲染等待页面
  const renderWaitingPage = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          {isInWaitingQueue ? '排队等待中' : '等待其他玩家加入'}
        </h1>
        {error && (
          <div className={`border px-4 py-3 rounded mb-4 ${
            isInWaitingQueue
              ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
              : 'bg-red-100 border-red-400 text-red-700'
          }`}>
            {error}
          </div>
        )}

        {isInWaitingQueue ? (
          <div className="text-center mb-6">
            <div className="text-4xl font-bold text-yellow-500 mb-2">
              排队第 {waitingPosition} 位
            </div>
            <p className="text-gray-600">等待当前游戏结束</p>
          </div>
        ) : (
          <div className="text-center mb-6">
            <div className="text-6xl font-bold text-blue-500 mb-2">
              {roomState?.playerCount || 0}/10
            </div>
            <p className="text-gray-600">需要10人才能开始游戏</p>
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">
            {isInWaitingQueue ? '当前游戏玩家：' : '当前玩家：'}
          </h3>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
            {roomState?.players.map((player) => (
              <div key={player.id} className="bg-gray-100 p-2 rounded text-center">
                {player.name}
                {currentPlayer?.id === player.id && " (你)"}
              </div>
            ))}
          </div>
        </div>

        {roomState?.waitingQueue && roomState.waitingQueue.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-700">
              等待队列 ({roomState.waitingCount}人)：
            </h3>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {roomState.waitingQueue.map((player, index) => (
                <div key={player.id} className="bg-yellow-100 p-2 rounded text-center">
                  {index + 1}. {player.name}
                  {currentPlayer?.id === player.id && " (你)"}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleLeaveRoom}
          disabled={loading}
          className="w-full bg-red-500 text-white p-3 rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '离开中...' : '离开房间'}
        </button>
      </div>
    </div>
  );

  // 渲染结果页面
  const renderResultPage = () => {
    // 使用保存的游戏结果，确保房间重置后仍能显示
    if (!gameResult) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100">
          <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md text-center">
            <h1 className="text-2xl font-bold mb-4 text-gray-800">游戏结果加载中...</h1>
            <button
              onClick={handleBackToHome}
              className="w-full bg-gray-500 text-white p-3 rounded-lg hover:bg-gray-600 transition-colors"
            >
              返回首页
            </button>
          </div>
        </div>
      );
    }

    const { teams, currentPlayerData } = gameResult;
    const team1 = teams.team1 || [];
    const team2 = teams.team2 || [];

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-4xl">
          <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
            分组结果
          </h1>

          {currentPlayerData?.isTraitor && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 text-center">
              <strong>你是内鬼！</strong>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-blue-50 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4 text-blue-800">第一队</h2>
              <div className="space-y-2">
                {team1.map((player) => (
                  <div key={player.id} className="bg-white p-3 rounded shadow">
                    {player.name}
                    {currentPlayerData?.id === player.id && " (你)"}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-green-50 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4 text-green-800">第二队</h2>
              <div className="space-y-2">
                {team2.map((player) => (
                  <div key={player.id} className="bg-white p-3 rounded shadow">
                    {player.name}
                    {currentPlayerData?.id === player.id && " (你)"}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleBackToHome}
            className="w-full bg-gray-500 text-white p-3 rounded-lg hover:bg-gray-600 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  };

  // 渲染游戏日志页面
  const renderLogsPage = () => {
    const formatTime = (timestamp: number) => {
      return new Date(timestamp).toLocaleString('zh-CN');
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h1 className="text-3xl font-bold text-center mb-4 text-gray-800">
              游戏日志
            </h1>
            <div className="text-center text-gray-600 mb-4">
              显示最近 {gameLogs.length} 场游戏
            </div>
            <div className="text-center">
              <button
                onClick={() => setShowLogs(false)}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                返回游戏结果
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {gameLogs.map((log) => (
              <div key={log.id} className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-800">
                    游戏 #{log.gameNumber}
                  </h2>
                  <span className="text-gray-600 text-sm">
                    {formatTime(log.timestamp)}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3 text-blue-800">第一队</h3>
                    <div className="space-y-2">
                      {log.teams.team1.map((player: any) => (
                        <div key={player.id} className={`p-2 rounded ${player.isTraitor ? 'bg-red-100 border border-red-300' : 'bg-white'}`}>
                          {player.name}
                          {player.isTraitor && <span className="ml-2 text-red-600 font-semibold">(内鬼)</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3 text-green-800">第二队</h3>
                    <div className="space-y-2">
                      {log.teams.team2.map((player: any) => (
                        <div key={player.id} className={`p-2 rounded ${player.isTraitor ? 'bg-red-100 border border-red-300' : 'bg-white'}`}>
                          {player.name}
                          {player.isTraitor && <span className="ml-2 text-red-600 font-semibold">(内鬼)</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-red-50 rounded-lg">
                  <h4 className="font-semibold text-red-800 mb-2">内鬼名单:</h4>
                  <div className="text-red-700">
                    {log.players.filter((p: any) => p.isTraitor).map((p: any) => p.name).join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {gameLogs.length === 0 && (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="text-gray-600 text-lg">还没有游戏记录</div>
              <div className="text-gray-500 mt-2">开始第一场游戏来查看日志！</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 主渲染逻辑
  if (showLogs) {
    return renderLogsPage();
  } else if (gameState === 'initial') {
    return renderEnteringPage();
  } else if (gameState === 'nameSet') {
    return renderNameSetPage();
  } else if (gameState === 'waiting') {
    return renderWaitingPage();
  } else if (gameState === 'result') {
    return renderResultPage();
  }

  return null;
}
