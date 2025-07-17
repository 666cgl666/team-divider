'use client';

import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { roomManager, Player, RoomState } from '@/lib/client-room';

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

  // 初始化时从cookie读取保存的名字
  useEffect(() => {
    const cookieName = Cookies.get('playerName');
    if (cookieName) {
      setSavedName(cookieName);
      setPlayerName(cookieName);
      setGameState('nameSet');
    }
  }, []);

  // 订阅房间状态变化
  useEffect(() => {
    const unsubscribe = roomManager.subscribe((state) => {
      setRoomState(state);

      // 如果游戏开始了，切换到结果页面
      if (state.gamePhase === 'playing' && gameState === 'waiting') {
        setGameState('result');
      }

      // 如果房间重置了，回到等待状态
      if (state.gamePhase === 'waiting' && gameState === 'result' && state.playerCount === 0) {
        // 房间已重置，但保持在结果页面让用户选择
      }
    });

    // 初始化状态
    setRoomState(roomManager.getRoomState());

    return unsubscribe;
  }, [gameState]);

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
  const handleJoinRoom = () => {
    if (!savedName) return;

    setLoading(true);
    setError('');

    try {
      const result = roomManager.joinRoom(savedName);
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
  const handleLeaveRoom = () => {
    if (!currentPlayer) return;

    setLoading(true);
    try {
      roomManager.leaveRoom(currentPlayer.id);
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
    setError('');
    setIsInWaitingQueue(false);
    setWaitingPosition(0);
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
    const team1 = roomState?.teams.team1 || [];
    const team2 = roomState?.teams.team2 || [];

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-4xl">
          <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
            分组结果
          </h1>

          {currentPlayer?.isTraitor && (
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
                    {currentPlayer?.id === player.id && " (你)"}
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
                    {currentPlayer?.id === player.id && " (你)"}
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

  // 根据游戏状态渲染不同页面
  switch (gameState) {
    case 'entering':
      return renderEnteringPage();
    case 'nameSet':
      return renderNameSetPage();
    case 'waiting':
      return renderWaitingPage();
    case 'result':
      return renderResultPage();
    default:
      return renderEnteringPage();
  }
}
