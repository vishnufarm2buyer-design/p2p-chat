import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Trophy, Gamepad2 } from 'lucide-react';
import { peerManager } from '@/services/webrtc/peerManager';

interface GameModalProps {
  peerUserId: string;
  peerUserName: string;
  currentUserId: string;
  onClose: () => void;
}

type BoardCell = 'X' | 'O' | null;

export const GameModal: React.FC<GameModalProps> = ({
  peerUserId,
  peerUserName,
  currentUserId,
  onClose
}) => {
  // Deterministic assign: Lexicographically smaller userId is 'X' (goes first)
  const isPlayerX = currentUserId < peerUserId;
  const mySymbol: BoardCell = isPlayerX ? 'X' : 'O';
  const peerSymbol: BoardCell = isPlayerX ? 'O' : 'X';

  const [board, setBoard] = useState<BoardCell[]>(Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState<BoardCell>('X');
  const [winner, setWinner] = useState<BoardCell | 'Draw' | null>(null);
  const [scores, setScores] = useState({ me: 0, peer: 0, draws: 0 });

  const checkWinner = (squares: BoardCell[]): BoardCell | 'Draw' | null => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (const [a, b, c] of lines) {
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    if (squares.every((sq) => sq !== null)) {
      return 'Draw';
    }
    return null;
  };

  useEffect(() => {
    const unbind = peerManager.onGameData((senderId, payload) => {
      if (senderId !== peerUserId) return;
      if (payload.action === 'move') {
        const nextBoard = [...payload.board];
        const nextTurn = payload.turn;
        setBoard(nextBoard);
        setCurrentTurn(nextTurn);

        const outcome = checkWinner(nextBoard);
        setWinner(outcome);
        if (outcome) {
          if (outcome === mySymbol) {
            setScores((s) => ({ ...s, me: s.me + 1 }));
          } else if (outcome === peerSymbol) {
            setScores((s) => ({ ...s, peer: s.peer + 1 }));
          } else if (outcome === 'Draw') {
            setScores((s) => ({ ...s, draws: s.draws + 1 }));
          }
        }
      } else if (payload.action === 'reset') {
        setBoard(Array(9).fill(null));
        setCurrentTurn('X');
        setWinner(null);
      }
    });

    return () => unbind();
  }, [peerUserId, mySymbol, peerSymbol]);

  const handleCellClick = (index: number) => {
    if (board[index] || winner || currentTurn !== mySymbol) return;

    const nextBoard = [...board];
    nextBoard[index] = mySymbol;
    const nextTurn = peerSymbol;

    setBoard(nextBoard);
    setCurrentTurn(nextTurn);

    const outcome = checkWinner(nextBoard);
    setWinner(outcome);
    if (outcome) {
      if (outcome === mySymbol) {
        setScores((s) => ({ ...s, me: s.me + 1 }));
      } else if (outcome === peerSymbol) {
        setScores((s) => ({ ...s, peer: s.peer + 1 }));
      } else if (outcome === 'Draw') {
        setScores((s) => ({ ...s, draws: s.draws + 1 }));
      }
    }

    peerManager.sendGameData(peerUserId, {
      action: 'move',
      board: nextBoard,
      turn: nextTurn
    });
  };

  const handleReset = () => {
    setBoard(Array(9).fill(null));
    setCurrentTurn('X');
    setWinner(null);

    peerManager.sendGameData(peerUserId, { action: 'reset' });
  };

  const isMyTurn = currentTurn === mySymbol && !winner;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/90 backdrop-blur-2xl p-4 animate-fade-in select-none">
      <div className="w-full max-w-sm bg-obsidian-900 border border-white/10 rounded-3xl shadow-2xl p-5 flex flex-col items-center gap-4">
        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">Tic-Tac-Toe</h3>
              <p className="text-[10px] text-slate-400">Direct P2P Match</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scoreboard */}
        <div className="grid grid-cols-3 w-full bg-obsidian-950/80 border border-white/5 rounded-2xl p-2.5 text-center">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">You ({mySymbol})</div>
            <div className="text-base font-bold text-cyan-400">{scores.me}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Draws</div>
            <div className="text-base font-bold text-slate-300">{scores.draws}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">{peerUserName} ({peerSymbol})</div>
            <div className="text-base font-bold text-rose-400">{scores.peer}</div>
          </div>
        </div>

        {/* Status indicator */}
        <div className="text-xs font-medium py-1 px-3 rounded-full border">
          {winner ? (
            winner === 'Draw' ? (
              <span className="text-amber-400">Game ended in a draw!</span>
            ) : winner === mySymbol ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" /> You won!
              </span>
            ) : (
              <span className="text-rose-400">{peerUserName} won!</span>
            )
          ) : isMyTurn ? (
            <span className="text-cyan-400">Your turn ({mySymbol})</span>
          ) : (
            <span className="text-slate-400">{peerUserName}'s turn ({peerSymbol})...</span>
          )}
        </div>

        {/* 3x3 Game Grid */}
        <div className="grid grid-cols-3 gap-2 w-64 h-64 bg-obsidian-950/60 p-2 rounded-2xl border border-white/5">
          {board.map((cell, idx) => (
            <button
              key={idx}
              onClick={() => handleCellClick(idx)}
              disabled={!isMyTurn || cell !== null}
              className={`rounded-xl flex items-center justify-center text-3xl font-black transition-all ${
                cell === 'X'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-inner'
                  : cell === 'O'
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-inner'
                  : 'bg-obsidian-850 hover:bg-white/[0.06] border border-white/5'
              } ${isMyTurn && cell === null ? 'cursor-pointer hover:border-cyan-500/50' : 'cursor-default'}`}
            >
              {cell}
            </button>
          ))}
        </div>

        {/* Bottom Actions */}
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 font-medium transition-all cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>New Round</span>
        </button>
      </div>
    </div>
  );
};
