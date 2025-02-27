import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { BrowserRouter as Router, Route, Switch, useParams } from 'react-router-dom';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import App from './Main';
const BOARD_SIZE = 15;

const firebaseConfig = {
  apiKey: "AIzaSyCwXLdaJvQ4D8uY-eylPEafxSfyteUOzes",
  authDomain: "echoes-unseen.firebaseapp.com",
  projectId: "echoes-unseen",
  storageBucket: "echoes-unseen.firebasestorage.app",
  messagingSenderId: "782670279231",
  appId: "1:782670279231:web:eff6b1d5d897b601393e8a",
  measurementId: "G-WPLHQ6R0G1"
};

// Initialize Firebase
const fire = initializeApp(firebaseConfig);
const analytics = getAnalytics(fire);

function createInitialBoard() {
  const board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      row.push(createCell());
    }
    board.push(row);
  }
  return board;
}

//JARED_TOOD: what happens when two players have listening devices in the same cell?
function createCell() {
  return {
    pieces: [],
    listeningDevice: {
      1: false,
      2: false
    },
    jammer: {
      1: false,
      2: false
    },
    intel: {
      1: {},
      2: {},
    },
  };
}

function generateGameId() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function Main() {
  const [gameState, setGameState] = useState(null);
  const [gameId, setGameId] = useState("")
  const [playerNumber, setPlayerNumber] = useState(null);
  const router = useRouter();
  const { gameId: gameIdQuery, p } = router.query;
  const db = getFirestore();

  useEffect(() => {
    // If there's a game ID in the URL, join that game as player 2
    if (gameIdQuery) {
      setGameId(gameIdQuery);
      setPlayerNumber(p || 1);
      joinGame(gameIdQuery);
    }
  }, [gameIdQuery]);

  const startNewGame = async () => {
    const newGameId = generateGameId();
    setGameId(newGameId);
    setPlayerNumber(1);

    const initialGameState = {
      board: JSON.stringify(createInitialBoard()),
      currentPlayer: 1,
      phase: 'setup',
      player1Setup: false,
      player2Setup: false,
      turn: 1
    };

    // Create new game document in Firestore
    await setDoc(doc(db, 'games', newGameId), initialGameState);
    router.push(`/game/${newGameId}`);
  };

  const joinGame = async (gameId) => {
    const gameDoc = await getDoc(doc(db, 'games', gameId));
    if (!gameDoc.exists()) {
      alert('Game not found!');
      router.push("/")
      return;
    }

    // Subscribe to game state changes
    const unsubscribe = onSnapshot(doc(db, 'games', gameId), (doc) => {
      if (doc.exists()) {
        const gameState = doc.data()
        const newBoard = gameState.board
        gameState.board = JSON.parse(gameState.board)
        setGameState(gameState);
      }
    });

    return () => unsubscribe();
  };

  const updateGameState = async (newState) => {
    if (!gameId) return;

    newState.board = JSON.stringify(newState.board)
    await setDoc(doc(db, 'games', gameId), newState, { merge: true });
  };

  const handleSetupComplete = async (player) => {
    const setupField = player === 1 ? 'player1Setup' : 'player2Setup';
    const updatedState = {
      ...gameState,
      [setupField]: true,
      currentPlayer: 3 - player
    };

    // If both players have completed setup, move to movement phase
    if (updatedState.player2Setup && updatedState.player1Setup) {
      updatedState.phase = 'movement';
      updatedState.currentPlayer = 1;
    }

    await updateGameState(updatedState);
  };

  const handleGameStateUpdate = async (newBoard, newCurrentPlayer, newPhase) => {
    const updatedState = {
      ...gameState,
      board: newBoard,
      currentPlayer: newCurrentPlayer,
      phase: newPhase,
      turn: gameState.turn + 1
    };
    await updateGameState(updatedState);
  };

  if (!gameId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-4xl mb-8">Echoes Unseen</h1>
        <button
          onClick={startNewGame}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Start New Game
        </button>
      </div>
    );
  }

  if (!gameState) {
    return <div>Loading game...</div>;
  }

  const isMyTurn = gameState.currentPlayer == playerNumber;
  const shareUrl = `${window.location.origin}/game/${gameId}?p=2`;

  return (
    <div className="container mx-auto p-4">
      {playerNumber === 1 && (
        <div className="mb-4 p-4 bg-gray-100 rounded">
          <code className="block p-2 bg-white">{shareUrl}</code>
        </div>
      )}

      <App
        gameState={gameState}
        playerNumber={playerNumber}
        isMyTurn={isMyTurn}
        onSetupComplete={() => handleSetupComplete(playerNumber)}
        onGameStateUpdate={handleGameStateUpdate}
      />
    </div>
  );
}

export default Main;