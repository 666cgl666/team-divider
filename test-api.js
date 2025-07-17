// 简单的API测试脚本
const BASE_URL = 'http://localhost:3000';

async function testJoinRoom(playerName) {
  try {
    const response = await fetch(`${BASE_URL}/api/room`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'join',
        playerName
      })
    });

    const result = await response.json();

    if (response.ok || response.status === 202) {
      console.log(`✅ ${playerName} 成功加入${response.status === 202 ? '等待队列' : '房间'}`);
      console.log(`   玩家ID: ${result.player.id}`);
      console.log(`   房间人数: ${result.roomState.playerCount}/10`);
      console.log(`   游戏阶段: ${result.roomState.gamePhase}`);
      if (result.waitingPosition) {
        console.log(`   等待队列位置: ${result.waitingPosition}`);
      }
      return result.player;
    } else {
      console.log(`❌ ${playerName} 加入失败: ${result.error}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ ${playerName} 请求失败:`, error.message);
    return null;
  }
}

async function testGetRoomState() {
  try {
    const response = await fetch(`${BASE_URL}/api/room`);
    const result = await response.json();
    
    console.log('\n📊 房间状态:');
    console.log(`   人数: ${result.playerCount}/10`);
    console.log(`   阶段: ${result.gamePhase}`);
    console.log(`   等待队列: ${result.waitingCount || 0}人`);
    console.log(`   玩家列表:`);
    result.players.forEach((player, index) => {
      console.log(`     ${index + 1}. ${player.name} (${player.id})`);
    });

    if (result.waitingQueue && result.waitingQueue.length > 0) {
      console.log(`   等待队列:`);
      result.waitingQueue.forEach((player, index) => {
        console.log(`     ${index + 1}. ${player.name} (${player.id})`);
      });
    }
    
    if (result.gamePhase === 'playing') {
      console.log('\n🎯 分队结果:');
      console.log('   第一队:');
      result.teams.team1.forEach(player => {
        console.log(`     - ${player.name} ${player.isTraitor ? '(内鬼)' : ''}`);
      });
      console.log('   第二队:');
      result.teams.team2.forEach(player => {
        console.log(`     - ${player.name} ${player.isTraitor ? '(内鬼)' : ''}`);
      });
    }
    
    return result;
  } catch (error) {
    console.log('❌ 获取房间状态失败:', error.message);
    return null;
  }
}

async function runTest() {
  console.log('🚀 开始测试团队分组游戏 API\n');
  
  // 测试加入15个玩家（测试等待队列）
  const playerNames = [
    '张三', '李四', '王五', '赵六', '钱七',
    '孙八', '周九', '吴十', '郑十一', '王十二',
    '陈十三', '林十四', '黄十五', '张三', '李四' // 测试重名和等待队列
  ];
  
  const players = [];
  
  for (const name of playerNames) {
    const player = await testJoinRoom(name);
    if (player) {
      players.push(player);
    }
    
    // 每次加入后检查房间状态
    await testGetRoomState();
    console.log('---');
    
    // 稍微延迟一下
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n✅ 测试完成!');
  
  // 最终状态检查
  console.log('\n🏁 最终房间状态:');
  await testGetRoomState();
}

// 运行测试
runTest().catch(console.error);
