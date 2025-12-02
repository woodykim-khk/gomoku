// ==========================================
// 오목 게임 (Gomoku) - JavaScript
// ==========================================

// 게임 상수
const BOARD_SIZE = 15;
const COLS = 'ABCDEFGHIJKLMNO';

// 게임 상태
let board = [];
let currentPlayer = 'black';
let gameOver = false;
let moveHistory = [];
let gameMode = 'pvp';
let timer = null;
let seconds = 0;
let soundEnabled = true;

// 오디오 컨텍스트
let audioCtx = null;

// ==========================================
// 오디오 관련 함수
// ==========================================

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!soundEnabled) return;
    initAudio();

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'place') {
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'win') {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            setTimeout(() => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
                osc.start(audioCtx.currentTime);
                osc.stop(audioCtx.currentTime + 0.3);
            }, i * 150);
        });
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('sound-toggle');
    btn.textContent = soundEnabled ? '🔊' : '🔇';
    btn.classList.toggle('muted', !soundEnabled);
}

// ==========================================
// 배경 애니메이션
// ==========================================

function initBackground() {
    const canvas = document.getElementById('bgCanvas');
    const ctx = canvas.getContext('2d');
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = [];
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 2 + 1,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            alpha: Math.random() * 0.5 + 0.2
        });
    }

    function animate() {
        ctx.fillStyle = 'rgba(13, 13, 18, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 215, 0, ${p.alpha})`;
            ctx.fill();
        });

        // 연결선
        particles.forEach((p1, i) => {
            particles.slice(i + 1).forEach(p2 => {
                const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                if (dist < 150) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = `rgba(255, 215, 0, ${0.1 * (1 - dist / 150)})`;
                    ctx.stroke();
                }
            });
        });

        requestAnimationFrame(animate);
    }
    animate();
}

// ==========================================
// 보드 관련 함수
// ==========================================

function initBoard() {
    const boardElement = document.getElementById('board');
    const cells = boardElement.querySelectorAll('.cell');
    cells.forEach(cell => cell.remove());

    board = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        board[row] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            board[row][col] = null;

            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.addEventListener('click', () => handleClick(row, col));
            boardElement.appendChild(cell);
        }
    }
}

// ==========================================
// 게임 모드 설정
// ==========================================

function setGameMode(mode) {
    gameMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    const whiteName = document.getElementById('white-name');
    if (mode === 'pvp') {
        whiteName.textContent = '백돌';
    } else {
        whiteName.textContent = mode === 'ai-easy' ? 'AI (쉬움)' : 'AI (어려움)';
    }
    
    resetGame();
}

// ==========================================
// 게임 플레이 함수
// ==========================================

function handleClick(row, col) {
    if (gameOver || board[row][col]) return;
    if (gameMode !== 'pvp' && currentPlayer === 'white') return;

    makeMove(row, col);
}

function makeMove(row, col) {
    placeStone(row, col);
    playSound('place');
    createRipple(row, col);

    moveHistory.push({ row, col, player: currentPlayer });
    updateMoveHistory();
    updateStats();
    document.getElementById('undo-btn').disabled = false;

    if (checkWin(row, col)) {
        endGame();
        return;
    }

    switchPlayer();

    // AI 턴
    if (gameMode !== 'pvp' && currentPlayer === 'white' && !gameOver) {
        setTimeout(() => aiMove(), 500);
    }
}

function placeStone(row, col) {
    board[row][col] = currentPlayer;

    // 이전 마지막 수 표시 제거
    document.querySelectorAll('.stone.last').forEach(s => s.classList.remove('last'));

    const boardElement = document.getElementById('board');
    const cells = boardElement.querySelectorAll('.cell');
    const cell = cells[row * BOARD_SIZE + col];

    const stone = document.createElement('div');
    stone.className = `stone ${currentPlayer} last`;
    cell.appendChild(stone);
    cell.classList.add('occupied');
}

function createRipple(row, col) {
    const boardElement = document.getElementById('board');
    const cells = boardElement.querySelectorAll('.cell');
    const cell = cells[row * BOARD_SIZE + col];
    const rect = cell.getBoundingClientRect();
    const boardRect = boardElement.getBoundingClientRect();

    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    ripple.style.left = (rect.left - boardRect.left + 17) + 'px';
    ripple.style.top = (rect.top - boardRect.top + 17) + 'px';
    boardElement.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
}

function switchPlayer() {
    currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
    updatePlayerDisplay();
}

function updatePlayerDisplay() {
    document.getElementById('player-black').classList.toggle('active', currentPlayer === 'black');
    document.getElementById('player-white').classList.toggle('active', currentPlayer === 'white');
}

// ==========================================
// 착수 기록 및 통계
// ==========================================

function updateMoveHistory() {
    const historyEl = document.getElementById('move-history');
    const lastMove = moveHistory[moveHistory.length - 1];
    
    const item = document.createElement('div');
    item.className = 'move-item';
    item.innerHTML = `
        <span class="move-number ${lastMove.player}">${moveHistory.length}</span>
        <span class="move-coord">${COLS[lastMove.col]}${BOARD_SIZE - lastMove.row}</span>
    `;
    historyEl.appendChild(item);
    historyEl.scrollTop = historyEl.scrollHeight;
}

function updateStats() {
    document.getElementById('move-count').textContent = moveHistory.length;
    const blackMoves = moveHistory.filter(m => m.player === 'black').length;
    const whiteMoves = moveHistory.filter(m => m.player === 'white').length;
    document.getElementById('black-count').textContent = blackMoves;
    document.getElementById('white-count').textContent = whiteMoves;
}

// ==========================================
// 타이머
// ==========================================

function startTimer() {
    stopTimer();
    seconds = 0;
    updateTimerDisplay();
    timer = setInterval(() => {
        seconds++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

function updateTimerDisplay() {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    document.getElementById('timer').textContent = `${mins}:${secs}`;
}

// ==========================================
// AI 로직
// ==========================================

function aiMove() {
    document.getElementById('thinking').classList.add('show');

    setTimeout(() => {
        let move;
        if (gameMode === 'ai-easy') {
            move = getEasyAIMove();
        } else {
            move = getHardAIMove();
        }

        document.getElementById('thinking').classList.remove('show');
        
        if (move) {
            makeMove(move.row, move.col);
        }
    }, 800);
}

function getEasyAIMove() {
    const emptyCells = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (!board[r][c]) {
                emptyCells.push({ row: r, col: c });
            }
        }
    }

    // 30% 확률로 랜덤, 70% 확률로 간단한 휴리스틱
    if (Math.random() < 0.3) {
        return emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }

    // 주변에 돌이 있는 위치 선호
    const scored = emptyCells.map(cell => {
        let score = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = cell.row + dr;
                const nc = cell.col + dc;
                if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc]) {
                    score++;
                }
            }
        }
        return { ...cell, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const topMoves = scored.filter(m => m.score === scored[0].score);
    return topMoves[Math.floor(Math.random() * topMoves.length)];
}

function getHardAIMove() {
    let bestScore = -Infinity;
    let bestMove = null;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c]) continue;

            // 주변에 돌이 없으면 스킵 (효율성)
            if (!hasNeighbor(r, c, 2)) continue;

            const score = evaluatePosition(r, c);
            if (score > bestScore) {
                bestScore = score;
                bestMove = { row: r, col: c };
            }
        }
    }

    // 첫 수면 중앙 근처
    if (!bestMove) {
        const center = Math.floor(BOARD_SIZE / 2);
        return { row: center, col: center };
    }

    return bestMove;
}

function hasNeighbor(row, col, range) {
    for (let dr = -range; dr <= range; dr++) {
        for (let dc = -range; dc <= range; dc++) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc]) {
                return true;
            }
        }
    }
    return false;
}

function evaluatePosition(row, col) {
    const directions = [
        [0, 1], [1, 0], [1, 1], [1, -1]
    ];

    let aiScore = 0;
    let playerScore = 0;

    directions.forEach(([dr, dc]) => {
        aiScore += evaluateLine(row, col, dr, dc, 'white');
        playerScore += evaluateLine(row, col, dr, dc, 'black');
    });

    // 방어보다 공격을 약간 선호
    return aiScore * 1.1 + playerScore;
}

function evaluateLine(row, col, dr, dc, player) {
    let count = 1;
    let openEnds = 0;
    let blocked = false;

    // 양방향 탐색
    for (const direction of [1, -1]) {
        let r = row + dr * direction;
        let c = col + dc * direction;
        let consecutive = 0;

        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
            if (board[r][c] === player) {
                consecutive++;
            } else if (board[r][c] === null) {
                if (consecutive > 0) openEnds++;
                break;
            } else {
                if (consecutive === 0) blocked = true;
                break;
            }
            r += dr * direction;
            c += dc * direction;
        }
        count += consecutive;
    }

    // 점수 계산
    if (count >= 5) return 100000;
    if (count === 4 && openEnds === 2) return 10000;
    if (count === 4 && openEnds === 1) return 1000;
    if (count === 3 && openEnds === 2) return 1000;
    if (count === 3 && openEnds === 1) return 100;
    if (count === 2 && openEnds === 2) return 100;
    if (count === 2 && openEnds === 1) return 10;

    return count;
}

// ==========================================
// 승리 체크
// ==========================================

function checkWin(row, col) {
    const directions = [
        [[0, 1], [0, -1]],
        [[1, 0], [-1, 0]],
        [[1, 1], [-1, -1]],
        [[1, -1], [-1, 1]]
    ];

    for (const [dir1, dir2] of directions) {
        const line = getLine(row, col, dir1, dir2);
        if (line.length >= 5) {
            highlightWinningStones(line);
            return true;
        }
    }
    return false;
}

function getLine(row, col, dir1, dir2) {
    const player = board[row][col];
    const line = [{ row, col }];

    for (const [dr, dc] of [dir1, dir2]) {
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
            line.push({ row: r, col: c });
            r += dr;
            c += dc;
        }
    }

    return line;
}

function highlightWinningStones(line) {
    const cells = document.querySelectorAll('.cell');
    line.forEach(({ row, col }) => {
        const stone = cells[row * BOARD_SIZE + col].querySelector('.stone');
        if (stone) stone.classList.add('winning');
    });
}

// ==========================================
// 게임 종료 및 효과
// ==========================================

function endGame() {
    gameOver = true;
    stopTimer();
    playSound('win');
    createConfetti();

    const modal = document.getElementById('modal');
    const winnerStone = document.getElementById('winner-stone');
    const winnerName = document.getElementById('winner-name');

    winnerStone.style.background = currentPlayer === 'black'
        ? 'radial-gradient(circle at 30% 30%, #666, #1a1a1a 70%)'
        : 'radial-gradient(circle at 30% 30%, #fff, #e0e0d8 70%)';

    if (gameMode === 'pvp') {
        winnerName.textContent = currentPlayer === 'black' ? '흑돌 승리!' : '백돌 승리!';
    } else {
        winnerName.textContent = currentPlayer === 'black' ? '플레이어 승리!' : 'AI 승리!';
    }

    document.getElementById('final-time').textContent = document.getElementById('timer').textContent;
    document.getElementById('final-moves').textContent = moveHistory.length;

    setTimeout(() => modal.classList.add('show'), 500);
}

function createConfetti() {
    const colors = ['#ffd700', '#ffb347', '#ff6b9d', '#00d4ff', '#fff'];
    for (let i = 0; i < 100; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 4000);
        }, i * 30);
    }
}

// ==========================================
// 게임 제어
// ==========================================

function resetGame() {
    gameOver = false;
    currentPlayer = 'black';
    moveHistory = [];

    document.getElementById('modal').classList.remove('show');
    document.getElementById('move-history').innerHTML = '';
    document.getElementById('undo-btn').disabled = true;

    initBoard();
    updatePlayerDisplay();
    updateStats();
    startTimer();
}

function undoMove() {
    if (moveHistory.length === 0 || gameOver) return;

    // AI 모드에서는 2수 무르기
    const undoCount = gameMode === 'pvp' ? 1 : 2;

    for (let i = 0; i < undoCount && moveHistory.length > 0; i++) {
        const lastMove = moveHistory.pop();
        board[lastMove.row][lastMove.col] = null;

        const cells = document.querySelectorAll('.cell');
        const cell = cells[lastMove.row * BOARD_SIZE + lastMove.col];
        const stone = cell.querySelector('.stone');
        if (stone) {
            stone.remove();
            cell.classList.remove('occupied');
        }

        const historyEl = document.getElementById('move-history');
        if (historyEl.lastChild) historyEl.removeChild(historyEl.lastChild);
    }

    if (moveHistory.length > 0) {
        const lastMove = moveHistory[moveHistory.length - 1];
        currentPlayer = lastMove.player === 'black' ? 'white' : 'black';
        
        // 마지막 수 표시 복원
        const cells = document.querySelectorAll('.cell');
        const stone = cells[lastMove.row * BOARD_SIZE + lastMove.col].querySelector('.stone');
        if (stone) stone.classList.add('last');
    } else {
        currentPlayer = 'black';
    }

    updatePlayerDisplay();
    updateStats();
    document.getElementById('undo-btn').disabled = moveHistory.length === 0;
}

// ==========================================
// 초기화
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initBackground();
    initBoard();
    startTimer();
});

